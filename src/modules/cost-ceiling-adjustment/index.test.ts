/**
 * Live, per-session, exact-value cost-ceiling control (NanoClaw #1, "set
 * ceiling v2") — the host module's submission flow, receipt ingest, and
 * reconciler. Real central DB (`initTestDb()`/`runMigrations()`) and REAL
 * inbound.db files on disk (so `insertMessageIfAbsent`'s idempotent-insert
 * behavior is exercised for real, not mocked). The dependencies that would
 * otherwise require a live container / a live runner process
 * (`container-runner.js`, `cli/session-cost-cap.js`) or a real `DATA_DIR`
 * layout (`session-manager.js`'s / `mailbox/sqlite/paths.js`'s path
 * resolution) are mocked — everything else in the call graph (the DB
 * accessor layer, `isImmortalGroup`) runs for real.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ensureSchema, openInboundDb as openInboundDbRaw } from '../../mailbox/sqlite/session-db.js';

// ── container-runner.js: no real container spawning in tests ───────────────
const mockIsContainerRunning = vi.fn();
const mockWakeContainer = vi.fn();
const mockGetActiveContainerInstanceId = vi.fn();
vi.mock('../../container-runner.js', () => ({
  isContainerRunning: (...a: unknown[]) => mockIsContainerRunning(...a),
  wakeContainer: (...a: unknown[]) => mockWakeContainer(...a),
  getActiveContainerInstanceId: (...a: unknown[]) => mockGetActiveContainerInstanceId(...a),
}));

// ── cli/session-cost-cap.js: control "live state" deterministically ────────
const mockReadSessionCostCapStatus = vi.fn();
const mockReadSessionCostControlProtocol = vi.fn();
vi.mock('../../cli/session-cost-cap.js', () => ({
  readSessionCostCapStatus: (...a: unknown[]) => mockReadSessionCostCapStatus(...a),
  readSessionCostControlProtocol: (...a: unknown[]) => mockReadSessionCostControlProtocol(...a),
}));

// ── mailbox/sqlite/paths.js + session-manager.js: real SQLite files under a
// controlled temp dir. Nothing else in this test's real (non-mocked) call
// graph imports either module, so a complete replacement (rather than a
// vi.importActual passthrough) is safe here.
let tmpDir: string;
function inboundPathFor(agentGroupId: string, sessionId: string): string {
  return path.join(tmpDir, `${agentGroupId}__${sessionId}__inbound.db`);
}
vi.mock('../../mailbox/sqlite/paths.js', () => ({
  inboundDbPath: (agentGroupId: string, sessionId: string) => inboundPathFor(agentGroupId, sessionId),
}));
vi.mock('../../session-manager.js', () => ({
  openInboundDb: (agentGroupId: string, sessionId: string) => openInboundDbRaw(inboundPathFor(agentGroupId, sessionId)),
}));

import { createAgentGroup, updateAgentGroup } from '../../db/agent-groups.js';
import { getCostCeilingAdjustment } from '../../db/cost-ceiling-adjustments.js';
import { getCostCapPolicy, setCostCapPolicy } from '../../db/cost-cap-policy.js';
import { ingestEpisode } from '../../db/cost-escalation-episodes.js';
import { closeDb, getDb, initTestDb, runMigrations } from '../../db/index.js';
import { createSession, updateSession } from '../../db/sessions.js';
import {
  __testHooks,
  ingestCostCeilingAdjustmentReceipt,
  reconcileCostCeilingAdjustments,
  submitCostCeilingAdjustment,
} from './index.js';

const SESSION_ID = 'sess-mod-1';
const AGENT_GROUP_ID = 'ag-mod';
const NOW = '2026-08-24T12:00:00.000Z';

function healthyCapView(over: Record<string, unknown> = {}) {
  return {
    session_id: SESSION_ID,
    agent_group_id: AGENT_GROUP_ID,
    status: 'stopped',
    cap_usd: 10,
    spent_usd: 155,
    immortal: false,
    window: 'lifetime',
    ceiling_usd: 150,
    budget_gen: 7,
    ...over,
  };
}

function readyHandshake(over: Record<string, unknown> = {}) {
  return { version: 2, runner_instance_id: 'nonce-current', ready_at: NOW, ...over };
}

/** Default "everything is healthy and ready" wiring — override per test. */
function wireDefaults(): void {
  mockIsContainerRunning.mockReturnValue(true);
  mockWakeContainer.mockResolvedValue(true);
  mockGetActiveContainerInstanceId.mockReturnValue('nonce-current');
  mockReadSessionCostCapStatus.mockResolvedValue(healthyCapView());
  mockReadSessionCostControlProtocol.mockResolvedValue(readyHandshake());
}

function validRequest(over: Record<string, unknown> = {}) {
  return {
    protocolVersion: 2,
    requestId: 'cca-req-1',
    sessionId: SESSION_ID,
    targetCeilingCents: 17500,
    expectedEpochKey: '7',
    expectedCeilingCents: 15000,
    ...over,
  };
}

function inboundRow(id: string): { kind: string; content: string } | undefined {
  const db = openInboundDbRaw(inboundPathFor(AGENT_GROUP_ID, SESSION_ID));
  try {
    return db.prepare('SELECT kind, content FROM messages_in WHERE id = ?').get(id) as
      | { kind: string; content: string }
      | undefined;
  } finally {
    db.close();
  }
}

function inboundRowCount(id: string): number {
  const db = openInboundDbRaw(inboundPathFor(AGENT_GROUP_ID, SESSION_ID));
  try {
    return (db.prepare('SELECT COUNT(*) AS n FROM messages_in WHERE id = ?').get(id) as { n: number }).n;
  } finally {
    db.close();
  }
}

/** Create the session's inbound.db on disk with the real schema (no rows). */
function provisionSessionDb(): void {
  fs.mkdirSync(tmpDir, { recursive: true });
  ensureSchema(inboundPathFor(AGENT_GROUP_ID, SESSION_ID), 'inbound');
}

beforeEach(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cost-ceiling-adjustment-test-'));
  const db = await initTestDb();
  await runMigrations(db);
  await createAgentGroup({ id: AGENT_GROUP_ID, name: 'mod', folder: 'mod', created_at: NOW });
  await createSession({
    id: SESSION_ID,
    agent_group_id: AGENT_GROUP_ID,
    messaging_group_id: null,
    thread_id: null,
    agent_provider: 'claude',
    status: 'active',
    container_status: 'running',
    last_active: NOW,
    created_at: NOW,
  });
  provisionSessionDb();
  wireDefaults();
  __testHooks.setHandshakeTimingForTest(60, 10);
});

afterEach(async () => {
  await closeDb();
  fs.rmSync(tmpDir, { recursive: true, force: true });
  vi.clearAllMocks();
  __testHooks.resetHandshakeTimingForTest();
});

describe('submitCostCeilingAdjustment — shape validation (400s, no DB/IO reached)', () => {
  it('rejects a non-2 protocolVersion', async () => {
    const res = await submitCostCeilingAdjustment(validRequest({ protocolVersion: 1 }));
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_protocol_version');
    expect(mockReadSessionCostCapStatus).not.toHaveBeenCalled();
  });

  it('rejects a missing/empty requestId', async () => {
    const res = await submitCostCeilingAdjustment(validRequest({ requestId: '' }));
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_request_id');
  });

  it('rejects a missing sessionId', async () => {
    const res = await submitCostCeilingAdjustment(validRequest({ sessionId: '' }));
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_session_id');
  });

  it.each([0, -100, 1.5, 100_001, 'not-a-number'])(
    'rejects an out-of-range/non-integer targetCeilingCents: %p',
    async (bad) => {
      const res = await submitCostCeilingAdjustment(validRequest({ targetCeilingCents: bad }));
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('invalid_target_ceiling_cents');
    },
  );

  it('accepts exactly $1,000.00 (100000 cents) at the shape-validation stage', async () => {
    mockReadSessionCostCapStatus.mockResolvedValue(healthyCapView({ ceiling_usd: 150, budget_gen: 7 }));
    const res = await submitCostCeilingAdjustment(
      validRequest({ targetCeilingCents: 100_000, expectedCeilingCents: 15000, expectedEpochKey: '7' }),
    );
    expect(res.status).not.toBe(400);
  });

  it('rejects a missing expectedEpochKey', async () => {
    const res = await submitCostCeilingAdjustment(validRequest({ expectedEpochKey: '' }));
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_expected_epoch_key');
  });

  it('rejects a negative/non-integer expectedCeilingCents', async () => {
    expect((await submitCostCeilingAdjustment(validRequest({ expectedCeilingCents: -1 }))).status).toBe(400);
    expect((await submitCostCeilingAdjustment(validRequest({ expectedCeilingCents: 1.5 }))).status).toBe(400);
  });

  it('rejects a no-op target (targetCeilingCents === expectedCeilingCents)', async () => {
    const res = await submitCostCeilingAdjustment(
      validRequest({ targetCeilingCents: 15000, expectedCeilingCents: 15000 }),
    );
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('no_op_target');
  });

  it('rejects a non-object body', async () => {
    expect((await submitCostCeilingAdjustment(null)).status).toBe(400);
    expect((await submitCostCeilingAdjustment('a string')).status).toBe(400);
    expect((await submitCostCeilingAdjustment([1, 2, 3])).status).toBe(400);
  });
});

describe('submitCostCeilingAdjustment — session/group resolution', () => {
  it('404s on an unknown session', async () => {
    const res = await submitCostCeilingAdjustment(validRequest({ sessionId: 'sess-nope' }));
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('session_not_found');
  });
});

describe('submitCostCeilingAdjustment — immortal groups are rejected AUTHORITATIVELY (central fields, not the runner self-report)', () => {
  it('is_admin=1 rejects with 422 BEFORE ever reading live runner state, even though the runner would report immortal:false', async () => {
    // is_admin is deliberately not updatable via updateAgentGroup (creation-time
    // only, matching container-runner.ts's "trust ONLY is_admin" write-access
    // guard) — create a dedicated admin group + session for this test.
    await createAgentGroup({ id: 'ag-admin', name: 'admin', folder: 'admin', is_admin: 1, created_at: NOW });
    await createSession({
      id: 'sess-admin',
      agent_group_id: 'ag-admin',
      messaging_group_id: null,
      thread_id: null,
      agent_provider: 'claude',
      status: 'active',
      container_status: 'running',
      last_active: NOW,
      created_at: NOW,
    });
    mockReadSessionCostCapStatus.mockResolvedValue(
      healthyCapView({ session_id: 'sess-admin', agent_group_id: 'ag-admin', immortal: false }),
    ); // if this were consulted, it'd say "go ahead"

    const res = await submitCostCeilingAdjustment(validRequest({ sessionId: 'sess-admin' }));
    expect(res.status).toBe(422);
    expect(res.body.error).toBe('immortal');
    expect(mockReadSessionCostCapStatus).not.toHaveBeenCalled(); // authoritative check short-circuits first
  });

  it("coworker_type='main' also rejects with 422, from the same authoritative check", async () => {
    await updateAgentGroup(AGENT_GROUP_ID, { coworker_type: 'main' });
    const res = await submitCostCeilingAdjustment(validRequest());
    expect(res.status).toBe(422);
    expect(res.body.error).toBe('immortal');
  });

  it("the runner's OWN self-report claiming immortal:true is still honored as a defense-in-depth backstop", async () => {
    // Group is NOT authoritatively immortal, but the runner's live state claims it is.
    mockReadSessionCostCapStatus.mockResolvedValue(healthyCapView({ immortal: true }));
    const res = await submitCostCeilingAdjustment(validRequest());
    expect(res.status).toBe(422);
    expect(res.body.error).toBe('immortal');
  });
});

describe('submitCostCeilingAdjustment — live cost state (422/409)', () => {
  it('422s cost_tracking_unavailable when status is unknown', async () => {
    mockReadSessionCostCapStatus.mockResolvedValue({
      session_id: SESSION_ID,
      agent_group_id: AGENT_GROUP_ID,
      status: 'unknown',
    });
    const res = await submitCostCeilingAdjustment(validRequest());
    expect(res.status).toBe(422);
    expect(res.body.error).toBe('cost_tracking_unavailable');
  });

  it('422s no_live_ceiling when ceiling_usd is 0 or absent', async () => {
    mockReadSessionCostCapStatus.mockResolvedValue(healthyCapView({ ceiling_usd: 0 }));
    expect((await submitCostCeilingAdjustment(validRequest())).body.error).toBe('no_live_ceiling');

    mockReadSessionCostCapStatus.mockResolvedValue(healthyCapView({ ceiling_usd: undefined }));
    expect((await submitCostCeilingAdjustment(validRequest())).body.error).toBe('no_live_ceiling');
  });

  it('422s cost_tracking_unavailable when budget_gen is missing', async () => {
    mockReadSessionCostCapStatus.mockResolvedValue(healthyCapView({ budget_gen: undefined }));
    const res = await submitCostCeilingAdjustment(validRequest());
    expect(res.status).toBe(422);
    expect(res.body.error).toBe('cost_tracking_unavailable');
  });

  it('409s stale when expectedEpochKey does not match the live generation', async () => {
    mockReadSessionCostCapStatus.mockResolvedValue(healthyCapView({ budget_gen: 8 })); // live is 8, request expects 7
    const res = await submitCostCeilingAdjustment(validRequest({ expectedEpochKey: '7' }));
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('stale');
  });

  it('409s stale when expectedCeilingCents does not match the live ceiling', async () => {
    mockReadSessionCostCapStatus.mockResolvedValue(healthyCapView({ ceiling_usd: 200 })); // live is $200, request expects $150
    const res = await submitCostCeilingAdjustment(validRequest({ expectedCeilingCents: 15000 }));
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('stale');
  });
});

describe('submitCostCeilingAdjustment — runner readiness (426/503); no control message ever reaches an unready runner', () => {
  it('503s when the container is not running and cannot be woken', async () => {
    mockIsContainerRunning.mockReturnValue(false);
    mockWakeContainer.mockResolvedValue(false);
    mockGetActiveContainerInstanceId.mockReturnValue(undefined);
    mockReadSessionCostControlProtocol.mockResolvedValue(undefined);

    const res = await submitCostCeilingAdjustment(validRequest());
    expect(res.status).toBe(503);
    expect(res.body.error).toBe('runner_not_ready');
    expect(await getCostCeilingAdjustment('cca-req-1')).toBeUndefined(); // never created
    expect(inboundRowCount('cost-ceiling-adjustment:cca-req-1')).toBe(0); // no control message written
  });

  it('503s on a STALE instance nonce — a handshake from a PRIOR spawn of the same session must not be accepted', async () => {
    mockGetActiveContainerInstanceId.mockReturnValue('nonce-CURRENT-SPAWN');
    mockReadSessionCostControlProtocol.mockResolvedValue(readyHandshake({ runner_instance_id: 'nonce-OLD-SPAWN' }));

    const res = await submitCostCeilingAdjustment(validRequest());
    expect(res.status).toBe(503);
    expect(inboundRowCount('cost-ceiling-adjustment:cca-req-1')).toBe(0);
  });

  it('503s when no handshake is ever published (old pre-feature runner) — never mistaken for 426', async () => {
    mockReadSessionCostControlProtocol.mockResolvedValue(undefined);
    const res = await submitCostCeilingAdjustment(validRequest());
    expect(res.status).toBe(503);
    expect(inboundRowCount('cost-ceiling-adjustment:cca-req-1')).toBe(0);
  });

  it('426s when the runner DOES publish a handshake but advertises a version other than 2', async () => {
    mockReadSessionCostControlProtocol.mockResolvedValue(readyHandshake({ version: 1 }));
    const res = await submitCostCeilingAdjustment(validRequest());
    expect(res.status).toBe(426);
    expect(res.body.error).toBe('unsupported_protocol');
    expect(inboundRowCount('cost-ceiling-adjustment:cca-req-1')).toBe(0);
  });

  it('wakes a non-running container before checking for the handshake', async () => {
    mockIsContainerRunning.mockReturnValue(false);
    // Simulate the container coming up: wakeContainer "succeeds" and by the
    // time the poll loop checks, the handshake is already there.
    mockWakeContainer.mockResolvedValue(true);
    const res = await submitCostCeilingAdjustment(validRequest());
    expect(mockWakeContainer).toHaveBeenCalled();
    expect(res.status).toBe(202);
  });
});

describe('submitCostCeilingAdjustment — happy path and ledger-outcome -> HTTP mapping', () => {
  it('202s and durably enqueues on first submission: ledger row + real inbound.db control message', async () => {
    const res = await submitCostCeilingAdjustment(validRequest());
    expect(res.status).toBe(202);
    expect(res.body.ok).toBe(true);
    expect(res.body.adjustmentId).toBe('cca-req-1');

    const row = await getCostCeilingAdjustment('cca-req-1');
    expect(row?.state).toBe('enqueued');
    expect(row?.session_id).toBe(SESSION_ID);
    expect(row?.target_ceiling_cents).toBe(17500);

    const msg = inboundRow('cost-ceiling-adjustment:cca-req-1');
    expect(msg?.kind).toBe('cost_override');
    const content = JSON.parse(msg!.content);
    expect(content).toEqual({
      protocolVersion: 2,
      operation: 'set_ceiling',
      adjustmentId: 'cca-req-1',
      expectedEpochKey: '7',
      expectedCeilingCents: 15000,
      targetCeilingCents: 17500,
    });
    expect(mockWakeContainer).toHaveBeenCalled();
  });

  it('a byte-identical retry (same requestId, same body) is 202 while still pending/enqueued', async () => {
    await submitCostCeilingAdjustment(validRequest());
    const res = await submitCostCeilingAdjustment(validRequest());
    expect(res.status).toBe(202);
    expect(inboundRowCount('cost-ceiling-adjustment:cca-req-1')).toBe(1); // not double-inserted
  });

  it('a retry after the row already went terminal returns 200, not 202', async () => {
    await submitCostCeilingAdjustment(validRequest());
    await ingestCostCeilingAdjustmentReceipt(
      {
        action: 'cost_ceiling_adjustment_result',
        protocolVersion: 2,
        adjustmentId: 'cca-req-1',
        sessionId: SESSION_ID,
        outcome: 'applied',
        expectedEpochKey: '7',
        resultEpochKey: '8',
        expectedCeilingCents: 15000,
        targetCeilingCents: 17500,
        resultCeilingCents: 17500,
        spentUsd: 155,
        status: 'ok',
      },
      { id: SESSION_ID, agent_group_id: AGENT_GROUP_ID } as never,
    );

    const res = await submitCostCeilingAdjustment(validRequest());
    expect(res.status).toBe(200);
    expect(res.body.state).toBe('applied');
  });

  it('400s same-id-different-body (id-conflict)', async () => {
    await submitCostCeilingAdjustment(validRequest());
    const res = await submitCostCeilingAdjustment(validRequest({ targetCeilingCents: 20000 }));
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('request_id_conflict');
  });

  it('409s when a card already resolved this exact epoch (episode-already-won)', async () => {
    await ingestEpisode({
      episode_id: 'esc-mod-1',
      short_id: 'cst-m01',
      session_id: SESSION_ID,
      agent_group_id: AGENT_GROUP_ID,
      reason: 'ceiling',
      window: 'lifetime',
      epoch_key: '7',
      immortal: false,
      created_at: NOW,
      decision_state: 'stopped', // already resolved via the card
    });
    const res = await submitCostCeilingAdjustment(validRequest());
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('card_already_decided');
  });

  it('409s epoch-conflict when two DIFFERENT requestIds race the same (session, epoch)', async () => {
    const first = await submitCostCeilingAdjustment(validRequest({ requestId: 'cca-first' }));
    expect(first.status).toBe(202);
    const second = await submitCostCeilingAdjustment(validRequest({ requestId: 'cca-second' }));
    expect(second.status).toBe(409);
    expect(second.body.error).toBe('epoch_conflict');
    expect(await getCostCeilingAdjustment('cca-second')).toBeUndefined();
  });
});

describe('submitCostCeilingAdjustment — wake failure retries without losing the accepted request', () => {
  it('a wake failure at submission time still returns 202 and leaves the row enqueued (not lost, not failed)', async () => {
    mockWakeContainer.mockResolvedValue(false);
    const res = await submitCostCeilingAdjustment(validRequest());
    expect(res.status).toBe(202);
    expect((await getCostCeilingAdjustment('cca-req-1'))?.state).toBe('enqueued'); // the message WAS written
    expect(inboundRowCount('cost-ceiling-adjustment:cca-req-1')).toBe(1);
  });
});

describe('submitCostCeilingAdjustment — a missing/reset session DB never accepts an old request', () => {
  it('is still 202 (durably ledgered) when the inbound.db does not exist, but never writes a control message and stays pending', async () => {
    fs.rmSync(inboundPathFor(AGENT_GROUP_ID, SESSION_ID), { force: true });
    const res = await submitCostCeilingAdjustment(validRequest());
    expect(res.status).toBe(202); // the ledger accept is real even if enqueue can't land yet
    expect((await getCostCeilingAdjustment('cca-req-1'))?.state).toBe('pending'); // NOT enqueued — nothing was written
    expect(fs.existsSync(inboundPathFor(AGENT_GROUP_ID, SESSION_ID))).toBe(false); // never reprovisioned
  });
});

describe('ingestCostCeilingAdjustmentReceipt', () => {
  const session = { id: SESSION_ID, agent_group_id: AGENT_GROUP_ID } as never;

  function receipt(over: Record<string, unknown> = {}) {
    return {
      action: 'cost_ceiling_adjustment_result',
      protocolVersion: 2,
      adjustmentId: 'cca-req-1',
      sessionId: SESSION_ID,
      outcome: 'applied',
      expectedEpochKey: '7',
      previousEpochKey: '7',
      resultEpochKey: '8',
      expectedCeilingCents: 15000,
      previousCeilingCents: 15000,
      targetCeilingCents: 17500,
      resultCeilingCents: 17500,
      spentUsd: 155,
      status: 'ok',
      ...over,
    };
  }

  it('records a valid applied receipt', async () => {
    await submitCostCeilingAdjustment(validRequest());
    await ingestCostCeilingAdjustmentReceipt(receipt(), session);
    expect((await getCostCeilingAdjustment('cca-req-1'))?.state).toBe('applied');
    expect((await getCostCeilingAdjustment('cca-req-1'))?.result_ceiling_cents).toBe(17500);
  });

  it('a replayed IDENTICAL receipt is idempotent', async () => {
    await submitCostCeilingAdjustment(validRequest());
    await ingestCostCeilingAdjustmentReceipt(receipt(), session);
    const before = await getCostCeilingAdjustment('cca-req-1');
    await ingestCostCeilingAdjustmentReceipt(receipt(), session);
    expect(await getCostCeilingAdjustment('cca-req-1')).toEqual(before);
  });

  it('a MISMATCHED/forged receipt (echoed fields disagree with the central record) is REJECTED, not accepted', async () => {
    await submitCostCeilingAdjustment(validRequest());
    await ingestCostCeilingAdjustmentReceipt(receipt({ expectedCeilingCents: 1 }), session);
    expect((await getCostCeilingAdjustment('cca-req-1'))?.state).toBe('enqueued'); // untouched
  });

  it('a receipt for an unknown adjustmentId does not throw', async () => {
    await expect(
      ingestCostCeilingAdjustmentReceipt(receipt({ adjustmentId: 'cca-nope' }), session),
    ).resolves.toBeUndefined();
  });

  it('a receipt missing adjustmentId/outcome does not throw and touches nothing', async () => {
    await submitCostCeilingAdjustment(validRequest());
    await expect(
      ingestCostCeilingAdjustmentReceipt({ action: 'cost_ceiling_adjustment_result' }, session),
    ).resolves.toBeUndefined();
    expect((await getCostCeilingAdjustment('cca-req-1'))?.state).toBe('enqueued');
  });
});

describe('reconcileCostCeilingAdjustments', () => {
  it('crash-after-insert-before-inbox-write: a pending row with no control message gets one written and advances to enqueued', async () => {
    // Simulate: the ledger row landed but the process died before enqueueAdjustment ran.
    const res = await submitCostCeilingAdjustment(validRequest());
    expect(res.status).toBe(202);
    // Force it back to the "crashed right after create" state for this test.
    const db = openInboundDbRaw(inboundPathFor(AGENT_GROUP_ID, SESSION_ID));
    db.prepare('DELETE FROM messages_in').run();
    db.close();
    await getDb().run(
      `UPDATE cost_ceiling_adjustments SET state='pending', enqueued_at=NULL WHERE adjustment_id=?`,
      'cca-req-1',
    );

    await reconcileCostCeilingAdjustments(NOW);

    expect((await getCostCeilingAdjustment('cca-req-1'))?.state).toBe('enqueued');
    expect(inboundRowCount('cost-ceiling-adjustment:cca-req-1')).toBe(1);
    const msg = inboundRow('cost-ceiling-adjustment:cca-req-1');
    expect(JSON.parse(msg!.content).targetCeilingCents).toBe(17500);
  });

  it('crash-after-inbox-write-before-enqueued-update: repaired WITHOUT double-inserting a second message', async () => {
    await submitCostCeilingAdjustment(validRequest());
    // The control message IS already there (from the real submit above); force
    // the ledger row back to 'pending' as if the state-advance never landed.
    await getDb().run(
      `UPDATE cost_ceiling_adjustments SET state='pending', enqueued_at=NULL WHERE adjustment_id=?`,
      'cca-req-1',
    );
    expect(inboundRowCount('cost-ceiling-adjustment:cca-req-1')).toBe(1);

    await reconcileCostCeilingAdjustments(NOW);

    expect((await getCostCeilingAdjustment('cca-req-1'))?.state).toBe('enqueued');
    expect(inboundRowCount('cost-ceiling-adjustment:cca-req-1')).toBe(1); // still exactly one row
  });

  it('wake failure during reconcile retries with backoff, never loses or terminalizes the row', async () => {
    mockWakeContainer.mockResolvedValue(false);
    await submitCostCeilingAdjustment(validRequest());
    // (submission's own enqueue already wrote the control message; now simulate
    // repeated wake failures on subsequent sweep ticks.)
    await reconcileCostCeilingAdjustments(NOW);

    const row = await getCostCeilingAdjustment('cca-req-1');
    expect(row?.state).toBe('enqueued'); // not rejected — never gives up
    expect(row?.enqueue_attempts).toBeGreaterThan(0);
    expect(row?.next_attempt_at).toBeTruthy();
    expect(new Date(row!.next_attempt_at!).getTime()).toBeGreaterThan(new Date(NOW).getTime());
  });

  it('terminalizes rejected/session_closed for a closed session', async () => {
    await submitCostCeilingAdjustment(validRequest());
    await updateSession(SESSION_ID, { status: 'closed' });
    await reconcileCostCeilingAdjustments(NOW);
    const row = await getCostCeilingAdjustment('cca-req-1');
    expect(row?.state).toBe('rejected');
    expect(row?.result_reason).toBe('session_closed');
  });

  it('terminalizes rejected/session_db_missing when the inbound.db is gone', async () => {
    await submitCostCeilingAdjustment(validRequest());
    fs.rmSync(inboundPathFor(AGENT_GROUP_ID, SESSION_ID), { force: true });
    await reconcileCostCeilingAdjustments(NOW);
    const row = await getCostCeilingAdjustment('cca-req-1');
    expect(row?.state).toBe('rejected');
    expect(row?.result_reason).toBe('session_db_missing');
  });

  it('terminalizes rejected/unsupported_protocol when the runner confirms an incompatible version', async () => {
    await submitCostCeilingAdjustment(validRequest());
    mockReadSessionCostControlProtocol.mockResolvedValue(readyHandshake({ version: 1 }));
    await reconcileCostCeilingAdjustments(NOW);
    const row = await getCostCeilingAdjustment('cca-req-1');
    expect(row?.state).toBe('rejected');
    expect(row?.result_reason).toBe('unsupported_protocol');
  });

  it('a row that is already terminal is never touched by the reconciler', async () => {
    await submitCostCeilingAdjustment(validRequest());
    await ingestCostCeilingAdjustmentReceipt(
      {
        action: 'cost_ceiling_adjustment_result',
        protocolVersion: 2,
        adjustmentId: 'cca-req-1',
        sessionId: SESSION_ID,
        outcome: 'applied',
        expectedEpochKey: '7',
        resultEpochKey: '8',
        expectedCeilingCents: 15000,
        targetCeilingCents: 17500,
        resultCeilingCents: 17500,
        spentUsd: 155,
        status: 'ok',
      },
      { id: SESSION_ID, agent_group_id: AGENT_GROUP_ID } as never,
    );
    const before = await getCostCeilingAdjustment('cca-req-1');
    fs.rmSync(inboundPathFor(AGENT_GROUP_ID, SESSION_ID), { force: true }); // would terminalize a NON-terminal row
    await reconcileCostCeilingAdjustments(NOW);
    expect(await getCostCeilingAdjustment('cca-req-1')).toEqual(before);
  });
});

describe('this feature never writes to cost_cap_policy', () => {
  it('a full validate -> create -> enqueue -> reconcile -> receipt cycle leaves an existing policy row untouched', async () => {
    await setCostCapPolicy({ groupFolder: '', ceilingUsd: 999, capUsd: 5, updatedBy: 'test' });
    const before = await getCostCapPolicy('');

    await submitCostCeilingAdjustment(validRequest());
    await reconcileCostCeilingAdjustments(NOW);
    await ingestCostCeilingAdjustmentReceipt(
      {
        action: 'cost_ceiling_adjustment_result',
        protocolVersion: 2,
        adjustmentId: 'cca-req-1',
        sessionId: SESSION_ID,
        outcome: 'applied',
        expectedEpochKey: '7',
        resultEpochKey: '8',
        expectedCeilingCents: 15000,
        targetCeilingCents: 17500,
        resultCeilingCents: 17500,
        spentUsd: 155,
        status: 'ok',
      },
      { id: SESSION_ID, agent_group_id: AGENT_GROUP_ID } as never,
    );

    expect(await getCostCapPolicy('')).toEqual(before);
  });
});
