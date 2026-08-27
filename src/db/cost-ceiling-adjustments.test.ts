/**
 * `cost_ceiling_adjustments` accessor (migration 942) — the money-safety
 * guarantees behind the live, per-session, exact-value cost-ceiling control
 * (NanoClaw #1, "set ceiling v2"). Mirrors `cost-escalation-episodes.test.ts`'s
 * conventions (real in-memory central DB), using `initSqliteTestDb()` +
 * explicit `runMigrations()` (not `initTestDb()`) so the schema-shape describe
 * block below can also reach the raw SQLite handle for PRAGMA introspection
 * and CHECK-constraint-violation testing, on the SAME connection every
 * accessor call in this file uses.
 *
 * The runner's epoch fence (poll-loop.setCeiling.test.ts) makes APPLY
 * exactly-once on the container side; these pin the host counterpart: at most
 * ONE adjustment is ever ENQUEUED per (session, epoch), a card decision and an
 * adjustment can never both win the same epoch, and a runner receipt is
 * idempotent-under-replay and rejected-if-forged.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createAgentGroup } from './agent-groups.js';
import { getCostCapPolicy, setCostCapPolicy } from './cost-cap-policy.js';
import { closeDb, getDb, initSqliteTestDb } from './connection.js';
import { sqliteRaw } from './drivers/sqlite.js';
import { runMigrations } from './migrations/index.js';
import { createSession } from './sessions.js';
import { createPendingApproval, getPendingApprovalsByAction } from './sessions.js';
import { COST_DECISION_ACTION, ingestEpisode, resolveCostEpisode } from './cost-escalation-episodes.js';
import {
  bumpCostCeilingAdjustmentAttempt,
  createCostCeilingAdjustment,
  getCostCeilingAdjustment,
  getCostCeilingAdjustmentBySessionEpoch,
  getLatestCostCeilingAdjustmentBySession,
  listUnfinishedCostCeilingAdjustments,
  markCostCeilingAdjustmentEnqueued,
  recordCostCeilingAdjustmentResult,
  rejectCostCeilingAdjustment,
} from './cost-ceiling-adjustments.js';

const SESSION_ID = 'sess-cca-1';
const NOW = '2026-08-24T12:00:00.000Z';

beforeEach(async () => {
  const db = await initSqliteTestDb();
  await runMigrations(db);
  await createAgentGroup({ id: 'ag-cca', name: 'cca', folder: 'cca', created_at: NOW });
  await createSession({
    id: SESSION_ID,
    agent_group_id: 'ag-cca',
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

interface CreateOverrides {
  adjustment_id?: string;
  expected_epoch_key?: string;
  expected_ceiling_cents?: number;
  target_ceiling_cents?: number;
  inbound_message_id?: string;
  session_id?: string;
  agent_group_id?: string;
}

function req(over: CreateOverrides = {}) {
  const adjustmentId = over.adjustment_id ?? 'cca-1';
  return {
    adjustment_id: adjustmentId,
    protocol_version: 2,
    session_id: over.session_id ?? SESSION_ID,
    agent_group_id: over.agent_group_id ?? 'ag-cca',
    expected_epoch_key: over.expected_epoch_key ?? '0',
    expected_ceiling_cents: over.expected_ceiling_cents ?? 15000,
    target_ceiling_cents: over.target_ceiling_cents ?? 17500,
    inbound_message_id: over.inbound_message_id ?? `cost-ceiling-adjustment:${adjustmentId}`,
    requested_at: NOW,
    requested_by: 'dashboard-admin',
  };
}

describe('migration 942 — schema shape', () => {
  // These probe the raw schema (columns/CHECKs/indexes/FK) with hand-written SQL
  // against the SAME shared connection `beforeEach` initializes (getDb(), the one
  // createAgentGroup/createSession/every accessor in this file also uses) — a
  // separate freshly-created `:memory:` DB would have no sessions/agent_groups
  // rows in it and every FK-checked insert below would fail for the wrong reason.

  it('has every column', () => {
    const raw = sqliteRaw(getDb());
    const cols = new Set(
      (raw.prepare("PRAGMA table_info('cost_ceiling_adjustments')").all() as Array<{ name: string }>).map(
        (c) => c.name,
      ),
    );
    for (const col of [
      'adjustment_id',
      'protocol_version',
      'session_id',
      'agent_group_id',
      'expected_epoch_key',
      'expected_ceiling_cents',
      'target_ceiling_cents',
      'state',
      'inbound_message_id',
      'requested_at',
      'requested_by',
      'enqueued_at',
      'completed_at',
      'result_epoch_key',
      'result_ceiling_cents',
      'result_spent_usd',
      'result_cost_status',
      'result_reason',
      'enqueue_attempts',
      'next_attempt_at',
      'last_error',
    ]) {
      expect(cols.has(col)).toBe(true);
    }
  });

  it('has both named indexes plus the UNIQUE(session_id, expected_epoch_key) auto-index', () => {
    const raw = sqliteRaw(getDb());
    const indexes = (raw.prepare("PRAGMA index_list('cost_ceiling_adjustments')").all() as Array<{ name: string }>).map(
      (i) => i.name,
    );
    expect(indexes).toContain('idx_cost_adjustment_reconcile');
    expect(indexes).toContain('idx_cost_adjustment_session');
    expect(indexes.some((n) => n.includes('sqlite_autoindex'))).toBe(true);
  });

  it('target_ceiling_cents CHECK enforces [1, 100000] — 0 and 100001 refused, 100000 accepted', () => {
    const raw = sqliteRaw(getDb());
    const insert = (targetCents: number, id: string) =>
      raw
        .prepare(
          `INSERT INTO cost_ceiling_adjustments
             (adjustment_id, protocol_version, session_id, agent_group_id, expected_epoch_key,
              expected_ceiling_cents, target_ceiling_cents, state, inbound_message_id, requested_at, requested_by)
           VALUES (?, 2, ?, 'ag-cca', ?, 0, ?, 'pending', ?, ?, 'x')`,
        )
        .run(id, SESSION_ID, id, targetCents, `msg-${id}`, NOW);

    expect(() => insert(0, 'chk-a')).toThrow(); // below range
    expect(() => insert(100_001, 'chk-b')).toThrow(); // above range
    expect(() => insert(100_000, 'chk-c')).not.toThrow(); // exactly the max — accepted
  });

  it('state CHECK refuses a value outside the five-state enum', () => {
    const raw = sqliteRaw(getDb());
    expect(() =>
      raw
        .prepare(
          `INSERT INTO cost_ceiling_adjustments
             (adjustment_id, protocol_version, session_id, agent_group_id, expected_epoch_key,
              expected_ceiling_cents, target_ceiling_cents, state, inbound_message_id, requested_at, requested_by)
           VALUES ('chk-d', 2, ?, 'ag-cca', '9', 0, 100, 'bogus-state', 'msg-chk-d', ?, 'x')`,
        )
        .run(SESSION_ID, NOW),
    ).toThrow();
  });

  it('FK CASCADE: deleting the session removes its adjustment rows', async () => {
    await createCostCeilingAdjustment(req());
    const raw = sqliteRaw(getDb());
    expect(
      raw.prepare('SELECT COUNT(*) AS n FROM cost_ceiling_adjustments WHERE session_id = ?').get(SESSION_ID),
    ).toEqual({ n: 1 });
    raw.prepare('DELETE FROM sessions WHERE id = ?').run(SESSION_ID);
    expect(
      raw.prepare('SELECT COUNT(*) AS n FROM cost_ceiling_adjustments WHERE session_id = ?').get(SESSION_ID),
    ).toEqual({ n: 0 });
  });

  it('UNIQUE(session_id, expected_epoch_key) refuses a second row for the same pair at the raw SQL level', () => {
    const raw = sqliteRaw(getDb());
    const insert = (adjustmentId: string) =>
      raw
        .prepare(
          `INSERT INTO cost_ceiling_adjustments
             (adjustment_id, protocol_version, session_id, agent_group_id, expected_epoch_key,
              expected_ceiling_cents, target_ceiling_cents, state, inbound_message_id, requested_at, requested_by)
           VALUES (?, 2, ?, 'ag-cca', '0', 0, 100, 'pending', ?, ?, 'x')`,
        )
        .run(adjustmentId, SESSION_ID, `msg-${adjustmentId}`, NOW);

    insert('u-1');
    expect(() => insert('u-2')).toThrow(); // same (session, epoch) — different adjustment_id
  });
});

describe('createCostCeilingAdjustment — idempotency and id-conflict', () => {
  it('a byte-identical retry (same adjustment_id, same body) is idempotent', async () => {
    const first = await createCostCeilingAdjustment(req());
    expect(first.outcome).toBe('created');

    const second = await createCostCeilingAdjustment(req());
    expect(second.outcome).toBe('idempotent-existing');
    if (second.outcome === 'idempotent-existing') {
      expect(second.row.adjustment_id).toBe('cca-1');
    }

    // Exactly one row exists.
    expect(await getCostCeilingAdjustment('cca-1')).toBeDefined();
  });

  it('the SAME adjustment_id reused with a DIFFERENT body is refused (id-conflict)', async () => {
    await createCostCeilingAdjustment(req({ target_ceiling_cents: 17500 }));
    const conflict = await createCostCeilingAdjustment(req({ target_ceiling_cents: 20000 }));
    expect(conflict.outcome).toBe('id-conflict');
    // The original row is untouched.
    expect((await getCostCeilingAdjustment('cca-1'))?.target_ceiling_cents).toBe(17500);
  });
});

describe('createCostCeilingAdjustment — concurrency control IS the UNIQUE(session_id, expected_epoch_key) constraint', () => {
  it('two DIFFERENT adjustment_ids racing the same (session, epoch) -> exactly one winner', async () => {
    const a = await createCostCeilingAdjustment(req({ adjustment_id: 'cca-a', expected_epoch_key: '0' }));
    expect(a.outcome).toBe('created');

    const b = await createCostCeilingAdjustment(req({ adjustment_id: 'cca-b', expected_epoch_key: '0' }));
    expect(b.outcome).toBe('epoch-conflict');
    if (b.outcome === 'epoch-conflict') {
      expect(b.row.adjustment_id).toBe('cca-a'); // the winner is reported back
    }

    // Only ONE row exists for this (session, epoch) — the loser was rolled back, not left as a stray row.
    expect((await getCostCeilingAdjustmentBySessionEpoch(SESSION_ID, '0'))?.adjustment_id).toBe('cca-a');
    expect(await getCostCeilingAdjustment('cca-b')).toBeUndefined();
  });

  it('different epochs never conflict — both are created', async () => {
    expect((await createCostCeilingAdjustment(req({ adjustment_id: 'cca-e0', expected_epoch_key: '0' }))).outcome).toBe(
      'created',
    );
    expect((await createCostCeilingAdjustment(req({ adjustment_id: 'cca-e1', expected_epoch_key: '1' }))).outcome).toBe(
      'created',
    );
  });
});

describe('createCostCeilingAdjustment — an adjustment racing a CARD decision is first-writer-wins', () => {
  it('a card that already WON (continued/stopped) this exact epoch refuses a new adjustment for it', async () => {
    await ingestEpisode({
      episode_id: 'esc-1',
      short_id: 'cst-001',
      session_id: SESSION_ID,
      agent_group_id: 'ag-cca',
      reason: 'ceiling',
      window: 'lifetime',
      epoch_key: '0',
      immortal: false,
      created_at: NOW,
    });
    await resolveCostEpisode('esc-1', 'continue', 'approval:someone', { nowIso: NOW });

    const result = await createCostCeilingAdjustment(req({ expected_epoch_key: '0' }));
    expect(result.outcome).toBe('episode-already-won');
    expect(await getCostCeilingAdjustment('cca-1')).toBeUndefined(); // never created
  });

  it('an adjustment that wins FIRST supersedes a still-pending card for the same epoch, and reaps its dashboard row', async () => {
    await ingestEpisode({
      episode_id: 'esc-2',
      short_id: 'cst-002',
      session_id: SESSION_ID,
      agent_group_id: 'ag-cca',
      reason: 'ceiling',
      window: 'lifetime',
      epoch_key: '0',
      immortal: false,
      created_at: NOW,
      decision_state: 'pending',
      card_state: 'undelivered',
    });
    await createPendingApproval({
      approval_id: 'appr-1',
      session_id: SESSION_ID,
      request_id: 'req-1',
      action: COST_DECISION_ACTION,
      payload: JSON.stringify({ episodeId: 'esc-2' }),
      created_at: NOW,
      agent_group_id: 'ag-cca',
      title: 'Cost ceiling reached',
      options_json: '[]',
    });

    const result = await createCostCeilingAdjustment(req({ expected_epoch_key: '0' }));
    expect(result.outcome).toBe('created');

    // The card's episode is now superseded — a delayed click on it can never apply.
    expect((await resolveCostEpisode('esc-2', 'continue', 'approval:late', { nowIso: NOW })).won).toBe(false);
    // ...and its dashboard row was deleted in the SAME transaction, not left dangling.
    expect(
      (await getPendingApprovalsByAction(COST_DECISION_ACTION)).find((a) => a.approval_id === 'appr-1'),
    ).toBeUndefined();
  });
});

describe('getLatestCostCeilingAdjustmentBySession / getCostCeilingAdjustmentBySessionEpoch', () => {
  it('returns undefined when none exist, and the right row once one does', async () => {
    expect(await getLatestCostCeilingAdjustmentBySession(SESSION_ID)).toBeUndefined();
    expect(await getCostCeilingAdjustmentBySessionEpoch(SESSION_ID, '0')).toBeUndefined();

    await createCostCeilingAdjustment(req({ adjustment_id: 'cca-x', expected_epoch_key: '0' }));
    expect((await getLatestCostCeilingAdjustmentBySession(SESSION_ID))?.adjustment_id).toBe('cca-x');
    expect((await getCostCeilingAdjustmentBySessionEpoch(SESSION_ID, '0'))?.adjustment_id).toBe('cca-x');
    expect(await getCostCeilingAdjustmentBySessionEpoch(SESSION_ID, '1')).toBeUndefined();
  });

  it('"latest" is the newest by requested_at, even when a different epoch is looked up separately', async () => {
    await createCostCeilingAdjustment(
      req({ adjustment_id: 'cca-old', expected_epoch_key: '0', target_ceiling_cents: 16000 }),
    );
    await markCostCeilingAdjustmentEnqueued('cca-old', NOW);
    await recordCostCeilingAdjustmentResult({
      adjustment_id: 'cca-old',
      outcome: 'applied',
      completed_at: NOW,
      result_epoch_key: '1',
      result_ceiling_cents: 16000,
      result_spent_usd: 1,
      result_cost_status: 'ok',
      result_reason: null,
      session_id: SESSION_ID,
      expected_epoch_key: '0',
      expected_ceiling_cents: 15000,
      target_ceiling_cents: 16000,
    });
    await createCostCeilingAdjustment(
      req({
        adjustment_id: 'cca-new',
        expected_epoch_key: '1',
        expected_ceiling_cents: 16000,
        target_ceiling_cents: 18000,
      }),
    );

    expect((await getLatestCostCeilingAdjustmentBySession(SESSION_ID))?.adjustment_id).toBe('cca-new');
    // The by-epoch lookup still finds the OLD one under its OWN epoch — this is
    // the exact property escalation-ingest supersede depends on (see
    // src/modules/cost-approval/index.test.ts).
    expect((await getCostCeilingAdjustmentBySessionEpoch(SESSION_ID, '0'))?.adjustment_id).toBe('cca-old');
    expect((await getCostCeilingAdjustmentBySessionEpoch(SESSION_ID, '1'))?.adjustment_id).toBe('cca-new');
  });
});

describe('markCostCeilingAdjustmentEnqueued', () => {
  it('advances pending -> enqueued, and is a no-op once already past pending', async () => {
    await createCostCeilingAdjustment(req());
    expect((await getCostCeilingAdjustment('cca-1'))?.state).toBe('pending');

    await markCostCeilingAdjustmentEnqueued('cca-1', NOW);
    expect((await getCostCeilingAdjustment('cca-1'))?.state).toBe('enqueued');
    expect((await getCostCeilingAdjustment('cca-1'))?.enqueued_at).toBe(NOW);

    // Calling it again after a terminal result must not un-terminalize the row.
    await recordCostCeilingAdjustmentResult({
      adjustment_id: 'cca-1',
      outcome: 'applied',
      completed_at: NOW,
      result_epoch_key: '1',
      result_ceiling_cents: 17500,
      result_spent_usd: 1,
      result_cost_status: 'ok',
      result_reason: null,
      session_id: SESSION_ID,
      expected_epoch_key: '0',
      expected_ceiling_cents: 15000,
      target_ceiling_cents: 17500,
    });
    await markCostCeilingAdjustmentEnqueued('cca-1', NOW);
    expect((await getCostCeilingAdjustment('cca-1'))?.state).toBe('applied');
  });
});

describe('recordCostCeilingAdjustmentResult — the runner-receipt CAS', () => {
  function baseResult(over: Partial<Parameters<typeof recordCostCeilingAdjustmentResult>[0]> = {}) {
    return {
      adjustment_id: 'cca-1',
      outcome: 'applied' as const,
      completed_at: NOW,
      result_epoch_key: '1',
      result_ceiling_cents: 17500,
      result_spent_usd: 12.5,
      result_cost_status: 'ok',
      result_reason: null,
      session_id: SESSION_ID,
      expected_epoch_key: '0',
      expected_ceiling_cents: 15000,
      target_ceiling_cents: 17500,
      ...over,
    };
  }

  it('records a first-time outcome and advances the row to terminal', async () => {
    await createCostCeilingAdjustment(req());
    await markCostCeilingAdjustmentEnqueued('cca-1', NOW);

    const result = await recordCostCeilingAdjustmentResult(baseResult());
    expect(result.outcome).toBe('recorded');
    const row = await getCostCeilingAdjustment('cca-1');
    expect(row?.state).toBe('applied');
    expect(row?.result_ceiling_cents).toBe(17500);
    expect(row?.result_spent_usd).toBe(12.5);
  });

  it('a replayed IDENTICAL receipt is idempotent — same terminal row, not re-applied', async () => {
    await createCostCeilingAdjustment(req());
    await markCostCeilingAdjustmentEnqueued('cca-1', NOW);
    await recordCostCeilingAdjustmentResult(baseResult());
    const before = await getCostCeilingAdjustment('cca-1');

    const replay = await recordCostCeilingAdjustmentResult(baseResult());
    expect(replay.outcome).toBe('replayed-identical');
    expect(await getCostCeilingAdjustment('cca-1')).toEqual(before);
  });

  it('a receipt for an unknown adjustment_id is reported not-found', async () => {
    expect((await recordCostCeilingAdjustmentResult(baseResult({ adjustment_id: 'cca-nope' }))).outcome).toBe(
      'not-found',
    );
  });

  it('a MISMATCHED/forged receipt (echoed fields disagree with the central record) is rejected, not accepted', async () => {
    await createCostCeilingAdjustment(req());
    await markCostCeilingAdjustmentEnqueued('cca-1', NOW);

    const forged = await recordCostCeilingAdjustmentResult(baseResult({ expected_ceiling_cents: 99999 }));
    expect(forged.outcome).toBe('mismatch');
    // Nothing committed — the row is still enqueued, not terminal.
    expect((await getCostCeilingAdjustment('cca-1'))?.state).toBe('enqueued');
  });

  it('a receipt claiming a DIFFERENT outcome than what is already on file is rejected as mismatch, not overwritten', async () => {
    await createCostCeilingAdjustment(req());
    await markCostCeilingAdjustmentEnqueued('cca-1', NOW);
    await recordCostCeilingAdjustmentResult(baseResult({ outcome: 'applied' }));

    const conflicting = await recordCostCeilingAdjustmentResult(
      baseResult({ outcome: 'rejected', result_reason: 'invalid_value' }),
    );
    expect(conflicting.outcome).toBe('mismatch');
    expect((await getCostCeilingAdjustment('cca-1'))?.state).toBe('applied'); // unchanged
  });
});

describe('listUnfinishedCostCeilingAdjustments / bumpCostCeilingAdjustmentAttempt / rejectCostCeilingAdjustment', () => {
  it('lists pending/enqueued rows due for attention, excludes terminal rows, and respects next_attempt_at backoff', async () => {
    await createCostCeilingAdjustment(req({ adjustment_id: 'cca-pending' }));
    await createCostCeilingAdjustment(req({ adjustment_id: 'cca-enqueued', expected_epoch_key: '1' }));
    await markCostCeilingAdjustmentEnqueued('cca-enqueued', NOW);
    await createCostCeilingAdjustment(req({ adjustment_id: 'cca-terminal', expected_epoch_key: '2' }));
    await markCostCeilingAdjustmentEnqueued('cca-terminal', NOW);
    await recordCostCeilingAdjustmentResult({
      adjustment_id: 'cca-terminal',
      outcome: 'applied',
      completed_at: NOW,
      result_epoch_key: '1',
      result_ceiling_cents: 17500,
      result_spent_usd: 1,
      result_cost_status: 'ok',
      result_reason: null,
      session_id: SESSION_ID,
      expected_epoch_key: '2',
      expected_ceiling_cents: 15000,
      target_ceiling_cents: 17500,
    });

    const unfinished = (await listUnfinishedCostCeilingAdjustments(NOW)).map((r) => r.adjustment_id);
    expect(unfinished).toContain('cca-pending');
    expect(unfinished).toContain('cca-enqueued');
    expect(unfinished).not.toContain('cca-terminal');

    // A future next_attempt_at excludes the row until due.
    await bumpCostCeilingAdjustmentAttempt('cca-pending', '2026-08-24T13:00:00.000Z', 'wake failed');
    expect((await listUnfinishedCostCeilingAdjustments(NOW)).map((r) => r.adjustment_id)).not.toContain('cca-pending');
    expect(
      (await listUnfinishedCostCeilingAdjustments('2026-08-24T13:00:01.000Z')).map((r) => r.adjustment_id),
    ).toContain('cca-pending');
    expect((await getCostCeilingAdjustment('cca-pending'))?.enqueue_attempts).toBe(1);
    expect((await getCostCeilingAdjustment('cca-pending'))?.last_error).toBe('wake failed');
  });

  it('rejectCostCeilingAdjustment terminalizes a non-terminal row and never overwrites an already-terminal one', async () => {
    await createCostCeilingAdjustment(req());
    await rejectCostCeilingAdjustment('cca-1', 'session_closed', NOW);
    expect((await getCostCeilingAdjustment('cca-1'))?.state).toBe('rejected');
    expect((await getCostCeilingAdjustment('cca-1'))?.result_reason).toBe('session_closed');

    // Now force it to 'applied' via the normal CAS path is impossible (already
    // terminal) — confirm reject() itself also refuses to flip an applied row.
    await createCostCeilingAdjustment(req({ adjustment_id: 'cca-applied', expected_epoch_key: '5' }));
    await markCostCeilingAdjustmentEnqueued('cca-applied', NOW);
    await recordCostCeilingAdjustmentResult({
      adjustment_id: 'cca-applied',
      outcome: 'applied',
      completed_at: NOW,
      result_epoch_key: '6',
      result_ceiling_cents: 17500,
      result_spent_usd: 1,
      result_cost_status: 'ok',
      result_reason: null,
      session_id: SESSION_ID,
      expected_epoch_key: '5',
      expected_ceiling_cents: 15000,
      target_ceiling_cents: 17500,
    });
    await rejectCostCeilingAdjustment('cca-applied', 'session_closed', NOW);
    expect((await getCostCeilingAdjustment('cca-applied'))?.state).toBe('applied'); // NOT clobbered
  });
});

describe('this feature never touches cost_cap_policy (the separate group-level, future-spawn-only table)', () => {
  it('a full create -> enqueue -> apply cycle leaves an existing cost_cap_policy row byte-for-byte unchanged', async () => {
    // Seed a policy row on the SAME live connection every accessor in this file
    // uses (getDb(), via initSqliteTestDb() in beforeEach) — a real cross-table
    // check, not a documentation comment.
    await setCostCapPolicy({ groupFolder: '', ceilingUsd: 50, capUsd: 10, updatedBy: 'test' });
    const before = await getCostCapPolicy('');
    expect(before).toBeDefined();

    await createCostCeilingAdjustment(req());
    await markCostCeilingAdjustmentEnqueued('cca-1', NOW);
    await recordCostCeilingAdjustmentResult({
      adjustment_id: 'cca-1',
      outcome: 'applied',
      completed_at: NOW,
      result_epoch_key: '1',
      result_ceiling_cents: 17500,
      result_spent_usd: 1,
      result_cost_status: 'ok',
      result_reason: null,
      session_id: SESSION_ID,
      expected_epoch_key: '0',
      expected_ceiling_cents: 15000,
      target_ceiling_cents: 17500,
    });
    await rejectCostCeilingAdjustment('cca-never-applies', 'session_closed', NOW); // no-op (unknown id) — also must not touch policy

    expect(await getCostCapPolicy('')).toEqual(before);
    // Sanity: the connection really is shared — getDb() here is the same
    // instance createCostCeilingAdjustment used above.
    expect(sqliteRaw(getDb()).prepare('SELECT COUNT(*) AS n FROM cost_cap_policy').get()).toEqual({ n: 1 });
  });
});
