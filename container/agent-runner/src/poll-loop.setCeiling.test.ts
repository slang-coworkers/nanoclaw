/**
 * `{protocolVersion:2, operation:'set_ceiling'}` — the live, per-session, exact-
 * value cost-ceiling control (NanoClaw #1, "set ceiling v2"). Pins the
 * money-safety invariants `applySetCeilingOverride` (poll-loop.ts) must uphold,
 * separate from the legacy continue/stop state machine already covered by
 * poll-loop.cost.test.ts (this file seeds/reads the SAME module-private
 * accumulator via `__costCapTestHooks`, so it follows that file's conventions
 * exactly — no module mocks, real in-memory session DB).
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';

import { closeSessionDb, getInboundDb, getOutboundDb, initTestSessionDb } from './mailbox/sqlite/connection.js';
import { getUndeliveredMessages, writeMessageOut } from './db/messages-out.js';
import { getCostCap, getCostControlProtocol, setCostCap } from './db/session-state.js';
import { __setConfigForTest } from './config.js';
import { __costCapTestHooks as H, runPollLoop } from './poll-loop.js';
import { MockProvider } from './providers/mock.js';
import type { RunnerConfig } from './config.js';
import type { MessageInRow } from './db/messages-in.js';

function cfg(over: Partial<RunnerConfig> = {}): RunnerConfig {
  return {
    provider: 'claude',
    assistantName: 'test',
    groupName: 'test',
    agentGroupId: 'ag-test',
    maxMessagesPerPrompt: 10,
    mcpServers: {},
    model: 'claude-opus-4-8',
    ...over,
  };
}

function seed(over: Parameters<typeof H.setState>[0] = {}): void {
  H.setState({
    costEnabled: true,
    costImmortal: false,
    costWindow: 'lifetime',
    costDayKey: undefined,
    costAllotmentUsd: 10,
    costCapUsd: 10,
    costSpentUsd: 0,
    costEscalatedAt: undefined,
    costDecision: undefined,
    costDecidedAt: undefined,
    costStopRequested: false,
    costCeilingUsd: 0,
    costCeilingAllotmentUsd: 0,
    costCeilingEscalated: false,
    costCeilingHardStop: false,
    costBudgetGen: 0,
    costEpisodeId: undefined,
    pendingCostNudge: undefined,
    ...over,
  });
}

/** A set_ceiling `cost_override` inbound row. */
function setCeilingMsg(over: {
  adjustmentId?: string;
  expectedEpochKey?: string | number;
  expectedCeilingCents?: number;
  targetCeilingCents?: number;
  id?: string;
}): MessageInRow {
  const adjustmentId = over.adjustmentId ?? 'cca-test';
  return {
    id: over.id ?? `in-${adjustmentId}`,
    kind: 'cost_override',
    content: JSON.stringify({
      protocolVersion: 2,
      operation: 'set_ceiling',
      adjustmentId,
      expectedEpochKey: String(over.expectedEpochKey ?? '0'),
      expectedCeilingCents: over.expectedCeilingCents ?? 0,
      targetCeilingCents: over.targetCeilingCents ?? 100,
    }),
  } as unknown as MessageInRow;
}

/** `cost_ceiling_adjustment_result` receipts written to the real outbound DB. */
function receipts(adjustmentId?: string): Array<{ content: string }> {
  return getUndeliveredMessages().filter((m) => {
    if (m.kind !== 'system') return false;
    let c: { action?: string; adjustmentId?: string };
    try {
      c = JSON.parse(m.content) as { action?: string; adjustmentId?: string };
    } catch {
      return false;
    }
    return c.action === 'cost_ceiling_adjustment_result' && (adjustmentId ? c.adjustmentId === adjustmentId : true);
  });
}

function receiptPayload(adjustmentId: string): Record<string, unknown> {
  const rows = receipts(adjustmentId);
  expect(rows).toHaveLength(1);
  return JSON.parse(rows[0].content) as Record<string, unknown>;
}

function ackStatus(messageId: string): string | undefined {
  const row = getOutboundDb()
    .prepare('SELECT status FROM processing_ack WHERE message_id = ?')
    .get(messageId) as { status: string } | undefined;
  return row?.status;
}

beforeEach(() => {
  initTestSessionDb();
  __setConfigForTest(cfg());
  seed();
});

afterEach(() => {
  __setConfigForTest(null);
  closeSessionDb();
});

describe('set_ceiling — healthy session', () => {
  it('exact raise applies verbatim, rotates the generation, and acks the inbound message', () => {
    seed({ costCeilingUsd: 100, costBudgetGen: 3, costSpentUsd: 10 });
    const msg = setCeilingMsg({ adjustmentId: 'cca-1', expectedEpochKey: 3, expectedCeilingCents: 10000, targetCeilingCents: 17500 });

    H.applyCostOverride(msg);

    const s = H.getState();
    expect(s.costCeilingUsd).toBeCloseTo(175);
    expect(s.costBudgetGen).toBe(4); // rotated
    expect(s.costStopRequested).toBe(false);
    expect(s.costCeilingHardStop).toBe(false);
    expect(H.computeCostStatus()).not.toBe('stopped');
    expect(ackStatus(msg.id)).toBe('completed');

    const receipt = receiptPayload('cca-1');
    expect(receipt).toMatchObject({
      outcome: 'applied',
      expectedEpochKey: '3',
      previousEpochKey: '3',
      resultEpochKey: '4',
      expectedCeilingCents: 10000,
      previousCeilingCents: 10000,
      targetCeilingCents: 17500,
      resultCeilingCents: 17500,
    });
    expect(getCostCap()?.ceilingUsd).toBeCloseTo(175);
  });

  it('lower that stays above spend applies, no stop, no nudge (never stopped)', () => {
    seed({ costCeilingUsd: 100, costBudgetGen: 0, costSpentUsd: 10 });
    H.applyCostOverride(setCeilingMsg({ adjustmentId: 'cca-2', expectedEpochKey: 0, expectedCeilingCents: 10000, targetCeilingCents: 5000 }));

    const s = H.getState();
    expect(s.costCeilingUsd).toBeCloseTo(50);
    expect(s.costStopRequested).toBe(false);
    expect(s.pendingCostNudge).toBeUndefined(); // never stopped -> no "you were resumed" nudge
    expect(receiptPayload('cca-2').outcome).toBe('applied');
  });

  it('lower to EXACTLY current spend stops immediately', () => {
    seed({ costCeilingUsd: 100, costBudgetGen: 0, costSpentUsd: 40 });
    H.applyCostOverride(setCeilingMsg({ adjustmentId: 'cca-3', expectedEpochKey: 0, expectedCeilingCents: 10000, targetCeilingCents: 4000 }));

    const s = H.getState();
    expect(s.costCeilingUsd).toBeCloseTo(40);
    expect(s.costStopRequested).toBe(true);
    expect(s.costCeilingHardStop).toBe(true);
    expect(H.computeCostStatus()).toBe('stopped');
  });

  it('lower BELOW current spend stops immediately', () => {
    seed({ costCeilingUsd: 100, costBudgetGen: 0, costSpentUsd: 40 });
    H.applyCostOverride(setCeilingMsg({ adjustmentId: 'cca-4', expectedEpochKey: 0, expectedCeilingCents: 10000, targetCeilingCents: 2000 }));

    const s = H.getState();
    expect(s.costCeilingUsd).toBeCloseTo(20); // set to EXACTLY the requested value, not clamped to spend
    expect(s.costStopRequested).toBe(true);
    expect(s.costCeilingHardStop).toBe(true);
  });
});

describe('set_ceiling — stopped session (the escalation-doesn\'t-rotate-the-epoch race)', () => {
  it('raise above spend resumes and queues the cost-consciousness nudge', () => {
    // Session already hard-stopped by a Tier-2 crossing (escalation never rotates the gen).
    seed({ costCeilingUsd: 50, costBudgetGen: 2, costSpentUsd: 60, costStopRequested: true, costCeilingHardStop: true });
    H.applyCostOverride(setCeilingMsg({ adjustmentId: 'cca-5', expectedEpochKey: 2, expectedCeilingCents: 5000, targetCeilingCents: 10000 }));

    const s = H.getState();
    expect(s.costCeilingUsd).toBeCloseTo(100);
    expect(s.costStopRequested).toBe(false);
    expect(s.costCeilingHardStop).toBe(false);
    expect(s.pendingCostNudge).toBeDefined();
    expect(s.pendingCostNudge).toContain('$60.00');
    expect(s.pendingCostNudge).toContain('$100.00');
  });

  it('raise still at/below the now-overshot spend remains stopped, at exactly the requested value', () => {
    seed({ costCeilingUsd: 50, costBudgetGen: 2, costSpentUsd: 90, costStopRequested: true, costCeilingHardStop: true });
    // Admin asked for $70 — a real raise from $50, but spend already overshot past it.
    H.applyCostOverride(setCeilingMsg({ adjustmentId: 'cca-6', expectedEpochKey: 2, expectedCeilingCents: 5000, targetCeilingCents: 7000 }));

    const s = H.getState();
    expect(s.costCeilingUsd).toBeCloseTo(70); // exactly the requested value — never silently substituted
    expect(s.costStopRequested).toBe(true); // still stopped: 90 >= 70
    expect(s.costCeilingHardStop).toBe(true);
    expect(s.pendingCostNudge).toBeUndefined(); // did not resume -> no nudge
    expect(receiptPayload('cca-6').outcome).toBe('applied'); // it DID apply — just didn't resume
  });

  it('required race: a stop that happens between browser-read and request-arrival still accepts the request (epoch/ceiling unchanged by escalation) and resolves against CURRENT spend', () => {
    // Browser read the session healthy: epoch 5, ceiling $50 (5000c), spend $10.
    seed({ costCeilingUsd: 50, costBudgetGen: 5, costSpentUsd: 10 });
    // Session crosses its ceiling before the request arrives — recordTurnCost sets
    // the stop flags but does NOT rotate costBudgetGen and does NOT change costCeilingUsd.
    H.recordTurnCost({
      type: 'usage',
      inputTokens: 0,
      outputTokens: 0,
      cacheCreationInputTokens: 0,
      cacheReadInputTokens: 0,
      ephemeral1hInputTokens: 0,
      ephemeral5mInputTokens: 0,
      durationMs: 0,
      totalCostUsd: 45, // 10 + 45 = 55 >= 50 -> hard stop
      numTurns: 1,
      sessionId: null,
    });
    expect(H.getState().costStopRequested).toBe(true);
    expect(H.getState().costBudgetGen).toBe(5); // unchanged — escalation never rotates the gen
    expect(H.getState().costCeilingUsd).toBeCloseTo(50); // unchanged

    // The browser's stale-looking (but still epoch/ceiling-VALID) request raises to $200.
    H.applyCostOverride(setCeilingMsg({ adjustmentId: 'cca-7', expectedEpochKey: 5, expectedCeilingCents: 5000, targetCeilingCents: 20000 }));

    const s = H.getState();
    expect(s.costCeilingUsd).toBeCloseTo(200); // 200 > 55 spend -> resumes
    expect(s.costStopRequested).toBe(false);
    expect(receiptPayload('cca-7').outcome).toBe('applied');
  });
});

describe('set_ceiling — immortal and disabled', () => {
  it('immortal request is REJECTED with zero mutation', () => {
    seed({ costImmortal: true, costWindow: 'daily', costCeilingUsd: 50, costBudgetGen: 1, costSpentUsd: 10 });
    const before = H.getState();

    H.applyCostOverride(setCeilingMsg({ adjustmentId: 'cca-8', expectedEpochKey: 1, expectedCeilingCents: 5000, targetCeilingCents: 20000 }));

    expect(H.getState()).toEqual(before); // zero mutation
    const receipt = receiptPayload('cca-8');
    expect(receipt.outcome).toBe('rejected');
    expect(receipt.reason).toBe('immortal');
  });

  it('cost tracking disabled -> REJECTED (cost_tracking_disabled), still acks with a receipt', () => {
    seed({ costEnabled: false });
    const msg = setCeilingMsg({ adjustmentId: 'cca-9' });

    H.applyCostOverride(msg);

    expect(receiptPayload('cca-9').outcome).toBe('rejected');
    expect(receiptPayload('cca-9').reason).toBe('cost_tracking_disabled');
    expect(ackStatus(msg.id)).toBe('completed');
  });
});

describe('set_ceiling — the $1,000 server-side maximum (runner independently enforces it)', () => {
  it('exactly $1,000.00 (100000 cents) is accepted', () => {
    seed({ costCeilingUsd: 50, costBudgetGen: 0, costSpentUsd: 0 });
    H.applyCostOverride(setCeilingMsg({ adjustmentId: 'cca-10', expectedEpochKey: 0, expectedCeilingCents: 5000, targetCeilingCents: 100_000 }));
    expect(H.getState().costCeilingUsd).toBeCloseTo(1000);
    expect(receiptPayload('cca-10').outcome).toBe('applied');
  });

  it('$1,000.01 (100001 cents) is REJECTED as invalid_value, zero mutation', () => {
    seed({ costCeilingUsd: 50, costBudgetGen: 0, costSpentUsd: 0 });
    const before = H.getState();
    H.applyCostOverride(setCeilingMsg({ adjustmentId: 'cca-11', expectedEpochKey: 0, expectedCeilingCents: 5000, targetCeilingCents: 100_001 }));
    expect(H.getState()).toEqual(before);
    const receipt = receiptPayload('cca-11');
    expect(receipt.outcome).toBe('rejected');
    expect(receipt.reason).toBe('invalid_value');
  });

  it('non-integer / zero / negative targets are REJECTED as invalid_value', () => {
    seed({ costCeilingUsd: 50, costBudgetGen: 0 });
    H.applyCostOverride(setCeilingMsg({ adjustmentId: 'cca-12a', expectedEpochKey: 0, expectedCeilingCents: 5000, targetCeilingCents: 0 }));
    expect(receiptPayload('cca-12a').reason).toBe('invalid_value');

    H.applyCostOverride(setCeilingMsg({ adjustmentId: 'cca-12b', expectedEpochKey: 0, expectedCeilingCents: 5000, targetCeilingCents: -500 }));
    expect(receiptPayload('cca-12b').reason).toBe('invalid_value');

    H.applyCostOverride(setCeilingMsg({ adjustmentId: 'cca-12c', expectedEpochKey: 0, expectedCeilingCents: 5000, targetCeilingCents: 12.5 }));
    expect(receiptPayload('cca-12c').reason).toBe('invalid_value');
  });
});

describe('set_ceiling — epoch/ceiling fence (conflict)', () => {
  it('epoch mismatch is REJECTED as conflict/epoch_mismatch, zero mutation', () => {
    seed({ costCeilingUsd: 50, costBudgetGen: 7, costSpentUsd: 5 });
    const before = H.getState();
    H.applyCostOverride(setCeilingMsg({ adjustmentId: 'cca-13', expectedEpochKey: 6, expectedCeilingCents: 5000, targetCeilingCents: 10000 }));

    expect(H.getState()).toEqual(before);
    const receipt = receiptPayload('cca-13');
    expect(receipt.outcome).toBe('conflict');
    expect(receipt.reason).toBe('epoch_mismatch');
    expect(receipt.resultEpochKey).toBe('7');
  });

  it('ceiling mismatch (right epoch, wrong expected ceiling) is REJECTED as conflict/ceiling_mismatch', () => {
    seed({ costCeilingUsd: 50, costBudgetGen: 7, costSpentUsd: 5 });
    const before = H.getState();
    H.applyCostOverride(setCeilingMsg({ adjustmentId: 'cca-14', expectedEpochKey: 7, expectedCeilingCents: 4999, targetCeilingCents: 10000 }));

    expect(H.getState()).toEqual(before);
    const receipt = receiptPayload('cca-14');
    expect(receipt.outcome).toBe('conflict');
    expect(receipt.reason).toBe('ceiling_mismatch');
    expect(receipt.resultCeilingCents).toBe(5000);
  });
});

describe('set_ceiling — exactly-once under redelivery / racing epochs', () => {
  it('two DIFFERENT requests racing the same epoch -> exactly one applies, the other conflicts', () => {
    seed({ costCeilingUsd: 50, costBudgetGen: 0, costSpentUsd: 5 });

    H.applyCostOverride(setCeilingMsg({ adjustmentId: 'cca-race-a', expectedEpochKey: 0, expectedCeilingCents: 5000, targetCeilingCents: 8000 }));
    expect(receiptPayload('cca-race-a').outcome).toBe('applied');
    expect(H.getState().costBudgetGen).toBe(1);

    // The second request was ALSO stamped against epoch 0 (it read live state
    // before the first one landed) — it must now be refused, not silently re-applied.
    H.applyCostOverride(setCeilingMsg({ adjustmentId: 'cca-race-b', expectedEpochKey: 0, expectedCeilingCents: 5000, targetCeilingCents: 9000 }));
    const receiptB = receiptPayload('cca-race-b');
    expect(receiptB.outcome).toBe('conflict');
    expect(receiptB.reason).toBe('epoch_mismatch');
    expect(H.getState().costCeilingUsd).toBeCloseTo(80); // A's value stands, B never applied
    expect(H.getState().costBudgetGen).toBe(1); // NOT rotated a second time
  });

  it('a duplicate/replayed copy of the SAME request (same adjustmentId+fields) does not rotate the generation twice', () => {
    // In production this exact double-invocation cannot happen through the
    // normal poll loop — markProcessing() writes a processing_ack row before
    // applyCostOverride ever runs, and getPendingMessages() excludes any id
    // with an existing processing_ack row, so a given inbound message is
    // dispatched here AT MOST ONCE in its lifetime. This test drives the
    // module function directly (bypassing that outer guard) to pin the
    // EPOCH FENCE itself as an independent, defense-in-depth backstop: even
    // if something upstream ever misbehaved and re-delivered the identical
    // request, the generation must not rotate — and, in fact, must not
    // mutate live state — a second time.
    seed({ costCeilingUsd: 50, costBudgetGen: 0, costSpentUsd: 5 });
    const msg = setCeilingMsg({ adjustmentId: 'cca-dup', expectedEpochKey: 0, expectedCeilingCents: 5000, targetCeilingCents: 8000 });

    H.applyCostOverride(msg);
    expect(H.getState().costBudgetGen).toBe(1);
    expect(H.getState().costCeilingUsd).toBeCloseTo(80);
    expect(receiptPayload('cca-dup').outcome).toBe('applied');

    // Redelivered: the epoch fence catches it BEFORE any state mutation (the
    // conflict branch never touches costBudgetGen/costCeilingUsd) — the
    // deterministic receipt id then collides with the first call's already-
    // committed receipt, so the doomed-to-fail second commit throws rather
    // than silently overwriting the first outcome. Either way the invariant
    // holds: no second mutation, no second rotation.
    expect(() => H.applyCostOverride(msg)).toThrow();
    expect(H.getState().costBudgetGen).toBe(1); // NOT rotated a second time
    expect(H.getState().costCeilingUsd).toBeCloseTo(80); // unchanged by the failed replay
  });
});

describe('set_ceiling — /clear, new_session, and daily rollover all make an old request stale', () => {
  it('/clear (resetCostForNewSession) rotates the gen — a pre-clear request conflicts', () => {
    seed({ costCeilingUsd: 50, costBudgetGen: 0, costSpentUsd: 5 });
    H.resetCostForNewSession();
    expect(H.getState().costBudgetGen).toBe(1);

    H.applyCostOverride(setCeilingMsg({ adjustmentId: 'cca-clear', expectedEpochKey: 0, expectedCeilingCents: 5000, targetCeilingCents: 8000 }));
    const receipt = receiptPayload('cca-clear');
    expect(receipt.outcome).toBe('conflict');
    expect(receipt.reason).toBe('epoch_mismatch');
  });

  it('a daily rollover rotates the gen — a pre-rollover request conflicts', () => {
    const todayUtc = new Date().toISOString().slice(0, 10);
    seed({ costImmortal: true, costWindow: 'daily', costDayKey: todayUtc, costCeilingUsd: 50, costBudgetGen: 0, costSpentUsd: 5 });
    H.setState({ costDayKey: '2000-01-01' }); // backdate to force rollover
    H.recordTurnCost({
      type: 'usage',
      inputTokens: 0,
      outputTokens: 0,
      cacheCreationInputTokens: 0,
      cacheReadInputTokens: 0,
      ephemeral1hInputTokens: 0,
      ephemeral5mInputTokens: 0,
      durationMs: 0,
      totalCostUsd: 1,
      numTurns: 1,
      sessionId: null,
    });
    expect(H.getState().costBudgetGen).toBe(1);
    // Immortal can't apply set_ceiling at all, so flip back to non-immortal to
    // isolate the epoch-rotation assertion from the separate immortal rejection.
    H.setState({ costImmortal: false });

    H.applyCostOverride(setCeilingMsg({ adjustmentId: 'cca-rollover', expectedEpochKey: 0, expectedCeilingCents: 5000, targetCeilingCents: 8000 }));
    expect(receiptPayload('cca-rollover').reason).toBe('epoch_mismatch');
  });
});

describe('set_ceiling — atomicity', () => {
  it('state + receipt + ack are all committed, or all absent, under an injected transaction failure', async () => {
    seed({ costCeilingUsd: 50, costBudgetGen: 0, costSpentUsd: 5 });
    const adjustmentId = 'cca-boom';
    // Poison the deterministic receipt id ahead of time so the INSERT inside the
    // atomic commit throws a REAL UNIQUE-constraint violation — a genuine
    // transaction failure, not a mock.
    await writeMessageOut({ id: `cost-ceiling-adjustment-result:${adjustmentId}`, kind: 'system', content: JSON.stringify({ poison: true }) });
    const capBefore = getCostCap();
    const msg = setCeilingMsg({ adjustmentId, expectedEpochKey: 0, expectedCeilingCents: 5000, targetCeilingCents: 8000 });

    expect(() => H.applyCostOverride(msg)).toThrow();

    // Nothing new committed: cost_cap unchanged, the inbound message's
    // processing_ack was never written — a caller must NOT mark it complete,
    // so it is retried/recovered rather than silently dropped.
    expect(getCostCap()).toEqual(capBefore);
    expect(ackStatus(msg.id)).toBeUndefined();
    // The in-memory accumulator was mutated before the failed commit (by
    // design — the commit, not the mutation, is the atomicity boundary the
    // spec calls out) but that is moot: since processing_ack never advanced,
    // the message is reprocessed from the SAME pre-mutation persisted state on
    // the next container start (initCostTracking reloads from getCostCap()).
  });
});

describe('set_ceiling — the runner-instance readiness handshake', () => {
  it('publishRunnerReadiness publishes the exact spawn nonce from NANOCLAW_RUNNER_INSTANCE_ID', () => {
    const prior = process.env.NANOCLAW_RUNNER_INSTANCE_ID;
    process.env.NANOCLAW_RUNNER_INSTANCE_ID = 'nonce-abc-123';
    try {
      H.publishRunnerReadiness();
      const handshake = getCostControlProtocol();
      expect(handshake?.version).toBe(2);
      expect(handshake?.runnerInstanceId).toBe('nonce-abc-123');
      expect(handshake?.readyAt).toBeDefined();
    } finally {
      if (prior === undefined) delete process.env.NANOCLAW_RUNNER_INSTANCE_ID;
      else process.env.NANOCLAW_RUNNER_INSTANCE_ID = prior;
    }
  });

  it('publishes nothing when no nonce is set (no env var — e.g. a pre-feature host)', () => {
    const prior = process.env.NANOCLAW_RUNNER_INSTANCE_ID;
    delete process.env.NANOCLAW_RUNNER_INSTANCE_ID;
    try {
      H.publishRunnerReadiness();
      expect(getCostControlProtocol()).toBeUndefined();
    } finally {
      if (prior !== undefined) process.env.NANOCLAW_RUNNER_INSTANCE_ID = prior;
    }
  });
});

describe('set_ceiling — the cost_cap capability signal the dashboard gates on', () => {
  // The dashboard's live ceiling control reads `protocolVersion` out of the
  // persisted cost_cap blob (via deriveControlVersion) and renders the stepper
  // only when it sees `>= 2`; an absent/`< 2` value renders "ceiling control:
  // not yet available (runner not upgraded)". So EVERY cost_cap write must carry
  // it — the handshake key alone (cost_control_protocol) is not read there.
  it('persistCostCap stamps protocolVersion:2 into the cost_cap blob', () => {
    seed({ costCeilingUsd: 100, costBudgetGen: 1 });
    H.persistCostCap();
    expect(getCostCap()?.protocolVersion).toBe(2);
  });

  it('persistCostCap stamps it even with no ceiling configured (control still gates on)', () => {
    seed({ costCeilingUsd: 0, costBudgetGen: 0 });
    H.persistCostCap();
    const blob = getCostCap();
    expect(blob?.protocolVersion).toBe(2);
    expect(blob?.ceilingUsd).toBe(0); // "cost tracking on, no ceiling set" — still an upgraded runner
  });

  it('a successful set_ceiling apply keeps protocolVersion:2 in the committed blob', () => {
    seed({ costCeilingUsd: 100, costBudgetGen: 3, costSpentUsd: 10 });
    H.applyCostOverride(
      setCeilingMsg({ adjustmentId: 'cca-pv', expectedEpochKey: 3, expectedCeilingCents: 10000, targetCeilingCents: 17500 }),
    );
    expect(getCostCap()?.protocolVersion).toBe(2);
  });
});

describe('set_ceiling — a mid-query lower ends the active provider stream immediately', () => {
  function insertChat(id: string, text: string) {
    getInboundDb()
      .prepare(
        `INSERT INTO messages_in (id, kind, timestamp, status, platform_id, channel_type, content)
         VALUES (?, 'chat', datetime('now'), 'pending', 'chan-1', 'discord', ?)`,
      )
      .run(id, JSON.stringify({ sender: 'Alice', text }));
  }

  function insertCostOverrideRow(id: string, content: object) {
    getInboundDb()
      .prepare(
        `INSERT INTO messages_in (id, kind, timestamp, status, content) VALUES (?, 'cost_override', datetime('now'), 'pending', ?)`,
      )
      .run(id, JSON.stringify(content));
  }

  async function waitFor(condition: () => boolean, timeoutMs: number): Promise<void> {
    const start = Date.now();
    while (!condition()) {
      if (Date.now() - start > timeoutMs) throw new Error('waitFor timeout');
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  }

  it('ends an indefinitely-open turn the moment a lower-to-stop request lands, without waiting for the turn to finish on its own', async () => {
    // MockProvider never emits a `usage` event, so recordTurnCost never fires —
    // seed persisted spend directly (the same `cost_cap` row shape
    // initCostTracking adopts on startup) so a lower-to-stop target is
    // achievable independent of that.
    setCostCap({
      capUsd: 10,
      spentUsd: 100,
      status: 'ok',
      immortal: false,
      window: 'lifetime',
      ceilingUsd: 150,
      budgetGen: 0,
    });
    // providerName:'claude' (not 'mock') so costEnabled's provider gate passes
    // — costEnabled only cares about this string label, independent of which
    // AgentProvider instance is actually driving the query.
    __setConfigForTest(cfg({ costCapT2Usd: 10, costCeilingT2Usd: 150 }));

    // A resolvable destination — dispatchResultText needs one to actually
    // route (and thus write to outbound) the first turn's <message> block.
    getInboundDb()
      .prepare(
        `INSERT INTO destinations (name, display_name, type, channel_type, platform_id, agent_group_id)
         VALUES ('discord-test', 'Discord Test', 'channel', 'discord', 'chan-1', NULL)`,
      )
      .run();
    insertChat('m1', 'do something long');

    // MockProvider's query goes into an INDEFINITE wait after its first result
    // (see providers/mock.ts) — it only ever ends via push()/end()/abort(). If
    // the mid-query override does not call query.end(), this test times out
    // waiting for a receipt that never comes — the timeout IS the negative case.
    const provider = new MockProvider({}, () => '<message to="discord-test">first reply</message>');
    const controller = new AbortController();
    const loop = runPollLoop({
      provider,
      providerName: 'claude',
      cwd: '/tmp',
      signal: controller.signal,
      activePollIntervalMs: 10,
    });
    loop.catch(() => {});

    try {
      await waitFor(
        () => getUndeliveredMessages().some((m) => m.kind === 'chat' && JSON.parse(m.content).text === 'first reply'),
        2000,
      );

      insertCostOverrideRow('sc-midquery', {
        protocolVersion: 2,
        operation: 'set_ceiling',
        adjustmentId: 'cca-midquery',
        expectedEpochKey: '0',
        expectedCeilingCents: 15000,
        targetCeilingCents: 5000, // < $100 already spent -> stops immediately
      });

      // Proves the stream ended promptly: MockProvider's generator would
      // otherwise never produce this receipt (nothing else ever calls end()).
      await waitFor(() => receipts('cca-midquery').length > 0, 2000);

      expect(receiptPayload('cca-midquery').outcome).toBe('applied');
      expect(H.getState().costStopRequested).toBe(true);
      expect(H.getState().costCeilingHardStop).toBe(true);
    } finally {
      controller.abort();
      await loop.catch(() => {});
    }
  });
});

describe('set_ceiling — the control payload never reaches the model prompt', () => {
  it('a cost_override row is excluded from the formatted prompt, by kind, before formatting', async () => {
    // Mirrors the exact gate in poll-loop.ts's runPollLoop: `if (msg.kind ===
    // 'cost_override') { applyCostOverride(msg); commandIds.push(msg.id);
    // continue; }` runs BEFORE any message is added to `normalMessages`, and
    // ONLY `normalMessages`/`keep` is ever passed to formatMessagesWithCommands.
    // A cost_override row's raw JSON therefore never reaches formatMessages.
    const { formatMessages } = await import('./formatter.js');
    const batch = [
      { id: 'chat-1', kind: 'chat', content: JSON.stringify({ sender: 'User', text: 'hello there' }) },
      setCeilingMsg({ adjustmentId: 'cca-secret-marker-xyz', expectedEpochKey: 0, expectedCeilingCents: 0, targetCeilingCents: 5000 }),
    ] as unknown as MessageInRow[];

    const normalMessages = batch.filter((m) => m.kind !== 'cost_override');
    expect(normalMessages).toHaveLength(1);

    const prompt = formatMessages(normalMessages);
    expect(prompt).toContain('hello there');
    expect(prompt).not.toContain('cca-secret-marker-xyz');
    expect(prompt).not.toContain('set_ceiling');
    expect(prompt).not.toContain('targetCeilingCents');
  });
});
