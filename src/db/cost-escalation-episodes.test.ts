/**
 * `cost_escalation_episodes` accessor — the host-side money-safety guarantees behind the
 * cost-cap escalation approval card (Option 2, migration 939).
 *
 * The runner's budget-generation fence (poll-loop.cost.test.ts) makes APPLY exactly-once;
 * these pin the host counterpart: at most ONE override is ever ENQUEUED per episode. Every
 * decision surface (card click, dashboard pill, expiry sweep) funnels through
 * `resolveCostEpisode` — a compare-and-set that must admit exactly one winner and refuse a
 * stale-epoch or past-expiry decision. Plus the idempotent ingest and the cap→ceiling
 * supersession that stops a stopped session also showing a "raise the cap?" card.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createAgentGroup } from './agent-groups.js';
import { recordGhThreadOrigin } from './gh-thread-origin.js';
import { closeDb, initTestDb, runMigrations } from './index.js';
import { createSession } from './sessions.js';
import {
  expireEpisode,
  getEpisode,
  getLatestEpisodeForSession,
  getPendingEpisodeForSession,
  ingestEpisode,
  listEscalationEpisodes,
  listExpiredPending,
  markEffectApplied,
  markEffectEnqueued,
  resolveCostEpisode,
  supersedeLiveCapEpisodes,
  supersedeObservedEpisodes,
  type CostEpisodeInsert,
} from './cost-escalation-episodes.js';

const SESSION_ID = 'sess-cost-1';
const NOW = '2026-08-20T12:00:00.000Z';

/** A minimal pending cap episode for SESSION_ID at epoch "5". */
function capEpisode(over: Partial<CostEpisodeInsert> = {}): CostEpisodeInsert {
  return {
    episode_id: 'esc-sess-cost-1-cap-5',
    short_id: 'cst-aaa001',
    session_id: SESSION_ID,
    agent_group_id: 'ag-cost',
    reason: 'cap',
    window: 'lifetime',
    epoch_key: '5',
    spent_usd: 12,
    cap_usd: 10,
    immortal: false,
    created_at: NOW,
    expires_at: '2026-08-21T12:00:00.000Z', // +24h
    ...over,
  };
}

beforeEach(async () => {
  const db = await initTestDb();
  await runMigrations(db);
  await createAgentGroup({ id: 'ag-cost', name: 'cost', folder: 'cost', created_at: NOW });
  await createSession({
    id: SESSION_ID,
    agent_group_id: 'ag-cost',
    messaging_group_id: null,
    thread_id: null,
    agent_provider: 'claude',
    status: 'active',
    container_status: 'running',
    last_active: NOW,
    created_at: NOW,
  });
});

afterEach(async () => {
  await closeDb();
});

describe('cost-escalation-episodes — listEscalationEpisodes (the `escalations` verb)', () => {
  it('lists episodes newest-first, enriched with coworker; filters by state/group/session', async () => {
    await ingestEpisode(
      capEpisode({
        episode_id: 'e-a',
        short_id: 'cst-a',
        decision_state: 'stopped',
        spent_usd: 20,
        created_at: '2026-08-20T12:00:00.000Z',
      }),
    );
    await createAgentGroup({ id: 'ag-two', name: 'Two', folder: 'two', created_at: NOW });
    await createSession({
      id: 'sess-two',
      agent_group_id: 'ag-two',
      messaging_group_id: null,
      thread_id: null,
      agent_provider: 'claude',
      status: 'active',
      container_status: 'running',
      last_active: NOW,
      created_at: NOW,
    });
    await ingestEpisode(
      capEpisode({
        episode_id: 'e-b',
        short_id: 'cst-b',
        session_id: 'sess-two',
        agent_group_id: 'ag-two',
        decision_state: 'continued',
        spent_usd: 5,
        created_at: '2026-08-20T13:00:00.000Z',
      }),
    );

    const all = await listEscalationEpisodes();
    expect(all.map((r) => r.episode_id)).toEqual(['e-b', 'e-a']); // newest-first
    expect(all.find((r) => r.episode_id === 'e-a')?.group_folder).toBe('cost');
    expect(all.find((r) => r.episode_id === 'e-b')?.group_folder).toBe('two');
    expect(all.find((r) => r.episode_id === 'e-a')?.gh_author).toBeNull(); // no gh thread

    expect((await listEscalationEpisodes({ state: 'stopped' })).map((r) => r.episode_id)).toEqual(['e-a']);
    expect((await listEscalationEpisodes({ groupFolder: 'two' })).map((r) => r.episode_id)).toEqual(['e-b']);
    expect((await listEscalationEpisodes({ sessionId: SESSION_ID })).map((r) => r.episode_id)).toEqual(['e-a']);
  });

  it('attributes a GitHub-thread session to its issue/PR author', async () => {
    await createSession({
      id: 'sess-gh',
      agent_group_id: 'ag-cost',
      messaging_group_id: null,
      thread_id: 'gh-issue-42',
      agent_provider: 'claude',
      status: 'active',
      container_status: 'running',
      last_active: NOW,
      created_at: NOW,
    });
    await recordGhThreadOrigin({
      threadId: 'gh-issue-42',
      repo: 'shader-slang/slang',
      number: 42,
      kind: 'issue',
      author: 'tangent-vector',
    });
    await ingestEpisode(
      capEpisode({ episode_id: 'e-gh', short_id: 'cst-gh', session_id: 'sess-gh', decision_state: 'stopped' }),
    );

    const byAuthor = await listEscalationEpisodes({ ghAuthor: 'tangent-vector' });
    expect(byAuthor.map((r) => r.episode_id)).toEqual(['e-gh']);
    expect(byAuthor[0].gh_author).toBe('tangent-vector');
    expect(byAuthor[0].gh_repo).toBe('shader-slang/slang');
    expect(byAuthor[0].gh_number).toBe(42);
    expect(await listEscalationEpisodes({ ghAuthor: 'nobody' })).toEqual([]); // no match
  });

  it('clamps limit to at least 1', async () => {
    await ingestEpisode(capEpisode({ episode_id: 'e-1', short_id: 'cst-1', created_at: '2026-08-20T12:00:00.000Z' }));
    await ingestEpisode(capEpisode({ episode_id: 'e-2', short_id: 'cst-2', created_at: '2026-08-20T13:00:00.000Z' }));
    expect((await listEscalationEpisodes({ limit: 1 })).length).toBe(1);
    expect((await listEscalationEpisodes({ limit: 0 })).length).toBe(1); // clamped to >= 1
    expect((await listEscalationEpisodes({ limit: 1.5 })).length).toBe(1); // non-integer floored → valid LIMIT (no datatype mismatch)
  });
});

describe('cost-escalation-episodes — idempotent ingest', () => {
  it('a re-emitted escalation (same episode_id) inserts exactly one row', async () => {
    expect(await ingestEpisode(capEpisode())).toBe(true); // first wins
    expect(await ingestEpisode(capEpisode({ short_id: 'cst-different' }))).toBe(false); // ON CONFLICT DO NOTHING
    const ep = await getEpisode('esc-sess-cost-1-cap-5');
    expect(ep?.decision_state).toBe('pending');
    expect(ep?.short_id).toBe('cst-aaa001'); // the first row, unchanged by the second ingest
  });
});

describe('cost-escalation-episodes — resolveCostEpisode is at-most-once (the enqueue CAS)', () => {
  it('two racing decisions on one episode → exactly one winner; the loser sees the terminal row', async () => {
    await ingestEpisode(capEpisode());

    const first = await resolveCostEpisode('esc-sess-cost-1-cap-5', 'continue', 'user:A', { nowIso: NOW });
    const second = await resolveCostEpisode('esc-sess-cost-1-cap-5', 'stop', 'user:B', { nowIso: NOW });

    expect(first.won).toBe(true);
    expect(second.won).toBe(false); // already resolved → no second override is ever enqueued
    expect(first.episode?.decision_state).toBe('continued');
    expect(second.episode?.decision_state).toBe('continued'); // loser re-renders the winner's result
    expect(second.episode?.resolved_by).toBe('user:A');
  });

  it('a re-delivered identical click (same decision) wins once, then no-ops', async () => {
    await ingestEpisode(capEpisode());
    expect((await resolveCostEpisode('esc-sess-cost-1-cap-5', 'continue', 'user:A', { nowIso: NOW })).won).toBe(true);
    // Host crash + retry re-delivers the same click → the CAS refuses it (already continued).
    expect((await resolveCostEpisode('esc-sess-cost-1-cap-5', 'continue', 'user:A', { nowIso: NOW })).won).toBe(false);
  });
});

describe('cost-escalation-episodes — epoch gate on resolve', () => {
  it('a decision whose expected epoch ≠ the episode epoch is REFUSED (stale card)', async () => {
    await ingestEpisode(capEpisode()); // epoch "5"

    const stale = await resolveCostEpisode('esc-sess-cost-1-cap-5', 'continue', 'user:A', {
      nowIso: NOW,
      expectedEpochKey: '4', // caller's view is a superseded generation
    });
    expect(stale.won).toBe(false);
    expect((await getEpisode('esc-sess-cost-1-cap-5'))?.decision_state).toBe('pending'); // untouched

    // The correct epoch still resolves.
    const live = await resolveCostEpisode('esc-sess-cost-1-cap-5', 'continue', 'user:A', {
      nowIso: NOW,
      expectedEpochKey: '5',
    });
    expect(live.won).toBe(true);
  });
});

describe('cost-escalation-episodes — expiry gate', () => {
  it('a click after expires_at cannot win; the sweep lists it and expireEpisode resolves it', async () => {
    await ingestEpisode(capEpisode({ expires_at: '2026-08-20T11:00:00.000Z' })); // already past at NOW

    const late = await resolveCostEpisode('esc-sess-cost-1-cap-5', 'continue', 'user:A', { nowIso: NOW });
    expect(late.won).toBe(false); // a late human click is refused IN the CAS predicate
    expect((await getEpisode('esc-sess-cost-1-cap-5'))?.decision_state).toBe('pending');

    const expired = await listExpiredPending(NOW);
    expect(expired.map((e) => e.episode_id)).toContain('esc-sess-cost-1-cap-5');

    // The human-click CAS ALSO refuses a 'expired' transition on a past-expiry row — the
    // expiry sweep must use its own mirror-image CAS, expireEpisode (a pure dismiss).
    expect((await resolveCostEpisode('esc-sess-cost-1-cap-5', 'expired', 'x', { nowIso: NOW })).won).toBe(false);
    expect((await expireEpisode('esc-sess-cost-1-cap-5', 'sweep:expiry', NOW)).won).toBe(true);
    expect((await getEpisode('esc-sess-cost-1-cap-5'))?.decision_state).toBe('expired');
  });

  it('expireEpisode does NOT fire on a not-yet-expired row, and loses to a human click', async () => {
    await ingestEpisode(capEpisode()); // expires +24h — not yet past at NOW
    expect((await expireEpisode('esc-sess-cost-1-cap-5', 'sweep:expiry', NOW)).won).toBe(false); // future expiry

    // A human wins first; a later expiry (even once past-due) finds it non-pending → loses.
    expect((await resolveCostEpisode('esc-sess-cost-1-cap-5', 'continue', 'user:A', { nowIso: NOW })).won).toBe(true);
    expect((await expireEpisode('esc-sess-cost-1-cap-5', 'sweep:expiry', '2026-08-22T00:00:00.000Z')).won).toBe(false);
    expect((await getEpisode('esc-sess-cost-1-cap-5'))?.decision_state).toBe('continued'); // human decision stands
  });
});

describe('cost-escalation-episodes — cap→ceiling supersession', () => {
  it('a ceiling for the same (session, epoch) supersedes a live cap card', async () => {
    await ingestEpisode(capEpisode()); // pending cap at epoch "5"
    await ingestEpisode(
      capEpisode({
        episode_id: 'esc-sess-cost-1-ceiling-5',
        short_id: 'cst-ceil05',
        reason: 'ceiling',
        decision_state: 'stopped',
      }),
    );

    const superseded = await supersedeLiveCapEpisodes(SESSION_ID, '5', NOW);
    expect(superseded.map((e) => e.episode_id)).toContain('esc-sess-cost-1-cap-5');
    expect((await getEpisode('esc-sess-cost-1-cap-5'))?.decision_state).toBe('superseded');
    // A subsequent click on the superseded cap card cannot win.
    expect((await resolveCostEpisode('esc-sess-cost-1-cap-5', 'continue', 'user:A', { nowIso: NOW })).won).toBe(false);
  });
});

describe('cost-escalation-episodes — getPendingEpisodeForSession (the dashboard-pill route)', () => {
  it('returns a live pending episode, but NOT an expired or already-resolved one', async () => {
    // No episode → pill falls back to the legacy unconditional override.
    expect(await getPendingEpisodeForSession(SESSION_ID, NOW)).toBeUndefined();

    await ingestEpisode(capEpisode()); // pending, expires +24h
    expect((await getPendingEpisodeForSession(SESSION_ID, NOW))?.episode_id).toBe('esc-sess-cost-1-cap-5');

    // An expired pending episode is excluded (the CAS would refuse it anyway → pill routes legacy).
    expect(await getPendingEpisodeForSession(SESSION_ID, '2026-08-25T00:00:00.000Z')).toBeUndefined();

    // Once resolved, it is no longer returned (reversing a Stop routes legacy).
    await resolveCostEpisode('esc-sess-cost-1-cap-5', 'stop', 'user:A', { nowIso: NOW });
    expect(await getPendingEpisodeForSession(SESSION_ID, NOW)).toBeUndefined();
  });

  it('returns the newest pending episode when more than one exists', async () => {
    await ingestEpisode(capEpisode({ created_at: '2026-08-20T10:00:00.000Z' }));
    await ingestEpisode(
      capEpisode({
        episode_id: 'esc-sess-cost-1-cap-6',
        short_id: 'cst-newer',
        epoch_key: '6',
        created_at: '2026-08-20T11:00:00.000Z',
      }),
    );
    expect((await getPendingEpisodeForSession(SESSION_ID, NOW))?.episode_id).toBe('esc-sess-cost-1-cap-6');
  });

  it('getLatestEpisodeForSession returns the newest episode in ANY state (the pill fence)', async () => {
    // No episodes → undefined → pill uses the legacy unconditional override.
    expect(await getLatestEpisodeForSession(SESSION_ID)).toBeUndefined();

    await ingestEpisode(capEpisode({ created_at: '2026-08-20T10:00:00.000Z' }));
    await resolveCostEpisode('esc-sess-cost-1-cap-5', 'continue', 'user:A', { nowIso: NOW }); // resolved

    // Even resolved, it is returned so the pill carries its epoch as the fence (P0 fix:
    // a bare unfenced pill Continue after a card Continue would double-grant).
    const latest = await getLatestEpisodeForSession(SESSION_ID);
    expect(latest?.episode_id).toBe('esc-sess-cost-1-cap-5');
    expect(latest?.epoch_key).toBe('5');
    expect(await getPendingEpisodeForSession(SESSION_ID, NOW)).toBeUndefined(); // but not "pending"
  });
});

describe('cost-escalation-episodes — activation supersede', () => {
  it('supersedeObservedEpisodes marks only S1 observed rows — never a live pending card', async () => {
    await ingestEpisode(capEpisode({ decision_state: 'observed', card_state: 'observed' }));
    await ingestEpisode(
      capEpisode({ episode_id: 'esc-sess-cost-1-cap-6', short_id: 'cst-pending', epoch_key: '6' }), // pending
    );

    expect(await supersedeObservedEpisodes(NOW)).toBe(1); // only the observed row
    expect((await getEpisode('esc-sess-cost-1-cap-5'))?.decision_state).toBe('superseded');
    expect((await getEpisode('esc-sess-cost-1-cap-6'))?.decision_state).toBe('pending'); // untouched
  });
});

describe('cost-escalation-episodes — effect setters are idempotent single-column advances', () => {
  it('markEffectEnqueued only advances from none; markEffectApplied is terminal', async () => {
    await ingestEpisode(capEpisode());
    await markEffectEnqueued('esc-sess-cost-1-cap-5');
    expect((await getEpisode('esc-sess-cost-1-cap-5'))?.effect_state).toBe('enqueued');
    await markEffectEnqueued('esc-sess-cost-1-cap-5'); // no-op (guard: effect_state='none')
    expect((await getEpisode('esc-sess-cost-1-cap-5'))?.effect_state).toBe('enqueued');
    await markEffectApplied('esc-sess-cost-1-cap-5');
    expect((await getEpisode('esc-sess-cost-1-cap-5'))?.effect_state).toBe('applied');
  });
});
