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
import { closeDb, initTestDb, runMigrations } from './index.js';
import { createSession } from './sessions.js';
import {
  expireEpisode,
  getEpisode,
  getPendingEpisodeForSession,
  ingestEpisode,
  listExpiredPending,
  markEffectApplied,
  markEffectEnqueued,
  resolveCostEpisode,
  supersedeLiveCapEpisodes,
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

beforeEach(() => {
  const db = initTestDb();
  runMigrations(db);
  createAgentGroup({ id: 'ag-cost', name: 'cost', folder: 'cost', created_at: NOW });
  createSession({
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

afterEach(() => {
  closeDb();
});

describe('cost-escalation-episodes — idempotent ingest', () => {
  it('a re-emitted escalation (same episode_id) inserts exactly one row', () => {
    expect(ingestEpisode(capEpisode())).toBe(true); // first wins
    expect(ingestEpisode(capEpisode({ short_id: 'cst-different' }))).toBe(false); // ON CONFLICT DO NOTHING
    const ep = getEpisode('esc-sess-cost-1-cap-5');
    expect(ep?.decision_state).toBe('pending');
    expect(ep?.short_id).toBe('cst-aaa001'); // the first row, unchanged by the second ingest
  });
});

describe('cost-escalation-episodes — resolveCostEpisode is at-most-once (the enqueue CAS)', () => {
  it('two racing decisions on one episode → exactly one winner; the loser sees the terminal row', () => {
    ingestEpisode(capEpisode());

    const first = resolveCostEpisode('esc-sess-cost-1-cap-5', 'continue', 'user:A', { nowIso: NOW });
    const second = resolveCostEpisode('esc-sess-cost-1-cap-5', 'stop', 'user:B', { nowIso: NOW });

    expect(first.won).toBe(true);
    expect(second.won).toBe(false); // already resolved → no second override is ever enqueued
    expect(first.episode?.decision_state).toBe('continued');
    expect(second.episode?.decision_state).toBe('continued'); // loser re-renders the winner's result
    expect(second.episode?.resolved_by).toBe('user:A');
  });

  it('a re-delivered identical click (same decision) wins once, then no-ops', () => {
    ingestEpisode(capEpisode());
    expect(resolveCostEpisode('esc-sess-cost-1-cap-5', 'continue', 'user:A', { nowIso: NOW }).won).toBe(true);
    // Host crash + retry re-delivers the same click → the CAS refuses it (already continued).
    expect(resolveCostEpisode('esc-sess-cost-1-cap-5', 'continue', 'user:A', { nowIso: NOW }).won).toBe(false);
  });
});

describe('cost-escalation-episodes — epoch gate on resolve', () => {
  it('a decision whose expected epoch ≠ the episode epoch is REFUSED (stale card)', () => {
    ingestEpisode(capEpisode()); // epoch "5"

    const stale = resolveCostEpisode('esc-sess-cost-1-cap-5', 'continue', 'user:A', {
      nowIso: NOW,
      expectedEpochKey: '4', // caller's view is a superseded generation
    });
    expect(stale.won).toBe(false);
    expect(getEpisode('esc-sess-cost-1-cap-5')?.decision_state).toBe('pending'); // untouched

    // The correct epoch still resolves.
    const live = resolveCostEpisode('esc-sess-cost-1-cap-5', 'continue', 'user:A', {
      nowIso: NOW,
      expectedEpochKey: '5',
    });
    expect(live.won).toBe(true);
  });
});

describe('cost-escalation-episodes — expiry gate', () => {
  it('a click after expires_at cannot win; the sweep lists it and expireEpisode resolves it', () => {
    ingestEpisode(capEpisode({ expires_at: '2026-08-20T11:00:00.000Z' })); // already past at NOW

    const late = resolveCostEpisode('esc-sess-cost-1-cap-5', 'continue', 'user:A', { nowIso: NOW });
    expect(late.won).toBe(false); // a late human click is refused IN the CAS predicate
    expect(getEpisode('esc-sess-cost-1-cap-5')?.decision_state).toBe('pending');

    const expired = listExpiredPending(NOW);
    expect(expired.map((e) => e.episode_id)).toContain('esc-sess-cost-1-cap-5');

    // The human-click CAS ALSO refuses a 'expired' transition on a past-expiry row — the
    // expiry sweep must use its own mirror-image CAS, expireEpisode (a pure dismiss).
    expect(resolveCostEpisode('esc-sess-cost-1-cap-5', 'expired', 'x', { nowIso: NOW }).won).toBe(false);
    expect(expireEpisode('esc-sess-cost-1-cap-5', 'sweep:expiry', NOW).won).toBe(true);
    expect(getEpisode('esc-sess-cost-1-cap-5')?.decision_state).toBe('expired');
  });

  it('expireEpisode does NOT fire on a not-yet-expired row, and loses to a human click', () => {
    ingestEpisode(capEpisode()); // expires +24h — not yet past at NOW
    expect(expireEpisode('esc-sess-cost-1-cap-5', 'sweep:expiry', NOW).won).toBe(false); // future expiry

    // A human wins first; a later expiry (even once past-due) finds it non-pending → loses.
    expect(resolveCostEpisode('esc-sess-cost-1-cap-5', 'continue', 'user:A', { nowIso: NOW }).won).toBe(true);
    expect(expireEpisode('esc-sess-cost-1-cap-5', 'sweep:expiry', '2026-08-22T00:00:00.000Z').won).toBe(false);
    expect(getEpisode('esc-sess-cost-1-cap-5')?.decision_state).toBe('continued'); // human decision stands
  });
});

describe('cost-escalation-episodes — cap→ceiling supersession', () => {
  it('a ceiling for the same (session, epoch) supersedes a live cap card', () => {
    ingestEpisode(capEpisode()); // pending cap at epoch "5"
    ingestEpisode(
      capEpisode({
        episode_id: 'esc-sess-cost-1-ceiling-5',
        short_id: 'cst-ceil05',
        reason: 'ceiling',
        decision_state: 'stopped',
      }),
    );

    const superseded = supersedeLiveCapEpisodes(SESSION_ID, '5', NOW);
    expect(superseded.map((e) => e.episode_id)).toContain('esc-sess-cost-1-cap-5');
    expect(getEpisode('esc-sess-cost-1-cap-5')?.decision_state).toBe('superseded');
    // A subsequent click on the superseded cap card cannot win.
    expect(resolveCostEpisode('esc-sess-cost-1-cap-5', 'continue', 'user:A', { nowIso: NOW }).won).toBe(false);
  });
});

describe('cost-escalation-episodes — getPendingEpisodeForSession (the dashboard-pill route)', () => {
  it('returns a live pending episode, but NOT an expired or already-resolved one', () => {
    // No episode → pill falls back to the legacy unconditional override.
    expect(getPendingEpisodeForSession(SESSION_ID, NOW)).toBeUndefined();

    ingestEpisode(capEpisode()); // pending, expires +24h
    expect(getPendingEpisodeForSession(SESSION_ID, NOW)?.episode_id).toBe('esc-sess-cost-1-cap-5');

    // An expired pending episode is excluded (the CAS would refuse it anyway → pill routes legacy).
    expect(getPendingEpisodeForSession(SESSION_ID, '2026-08-25T00:00:00.000Z')).toBeUndefined();

    // Once resolved, it is no longer returned (reversing a Stop routes legacy).
    resolveCostEpisode('esc-sess-cost-1-cap-5', 'stop', 'user:A', { nowIso: NOW });
    expect(getPendingEpisodeForSession(SESSION_ID, NOW)).toBeUndefined();
  });

  it('returns the newest pending episode when more than one exists', () => {
    ingestEpisode(capEpisode({ created_at: '2026-08-20T10:00:00.000Z' }));
    ingestEpisode(
      capEpisode({
        episode_id: 'esc-sess-cost-1-cap-6',
        short_id: 'cst-newer',
        epoch_key: '6',
        created_at: '2026-08-20T11:00:00.000Z',
      }),
    );
    expect(getPendingEpisodeForSession(SESSION_ID, NOW)?.episode_id).toBe('esc-sess-cost-1-cap-6');
  });
});

describe('cost-escalation-episodes — effect setters are idempotent single-column advances', () => {
  it('markEffectEnqueued only advances from none; markEffectApplied is terminal', () => {
    ingestEpisode(capEpisode());
    markEffectEnqueued('esc-sess-cost-1-cap-5');
    expect(getEpisode('esc-sess-cost-1-cap-5')?.effect_state).toBe('enqueued');
    markEffectEnqueued('esc-sess-cost-1-cap-5'); // no-op (guard: effect_state='none')
    expect(getEpisode('esc-sess-cost-1-cap-5')?.effect_state).toBe('enqueued');
    markEffectApplied('esc-sess-cost-1-cap-5');
    expect(getEpisode('esc-sess-cost-1-cap-5')?.effect_state).toBe('applied');
  });
});
