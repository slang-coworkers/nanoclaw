/**
 * Exact Claude accounting in the live counter: final per-call usage and the
 * `modelUsage` backstop (claude-usage.ts, recordMessageCost, settleClaudeTurn).
 *
 * THE BUG THIS PINS. The SDK streams each content block of a call as its own
 * assistant message, all carrying the `message_start` SNAPSHOT — final input
 * and cache, but `output_tokens` of 1–30. #1329 charged the first block of each
 * id and ignored the rest, so the counter (and the cost_events ledger) kept ~1%
 * of output tokens: on prod session sess-1785902924001-jylfb4 a call the
 * transcript and the OneCLI gateway both record as 8,178 output tokens was
 * charged as 8. Calls the stream never shows (compaction, Claude Code's helper
 * calls) were not charged at all.
 *
 * Every case asserts BOTH the counter and that the ledger sums to it — the
 * ledger is what the gateway acceptance check (scripts/verify-cost-ledger-vs-
 * gateway.py) compares against prod billing.
 *
 * Same convention as poll-loop.message-cost.test.ts: no module mocks, a real
 * in-memory session DB, real pricing.
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';

import { closeSessionDb, getOutboundDb, initTestSessionDb } from './mailbox/sqlite/connection.js';
import { __setConfigForTest } from './config.js';
import { __costCapTestHooks as H } from './poll-loop.js';
import { __resetCodexCostMemo } from './codex-cost.js';
import { createCostEventsTable, sumWindow } from './cost-events.js';
import { RATE_TABLE } from './cost-rate-table.js';
import { newBackstopState, priceVec, zeroVec, type TokenVec } from './claude-usage.js';
import type { RunnerConfig } from './config.js';
import type { ProviderEvent } from './providers/types.js';

const OPUS = 'aws/anthropic/bedrock-claude-opus-5-5';
const HAIKU = 'azure/anthropic/claude-haiku-4-5';
const SID = 'sess-sdk-A';

type MU = Extract<ProviderEvent, { type: 'message_usage' }>;
type UsageEv = Extract<ProviderEvent, { type: 'usage' }>;

function cfg(over: Partial<RunnerConfig> = {}): RunnerConfig {
  return {
    provider: 'claude',
    assistantName: 'test',
    groupName: 'test',
    agentGroupId: 'ag-test',
    maxMessagesPerPrompt: 10,
    mcpServers: {},
    model: OPUS,
    costCapT2Usd: 10_000,
    ...over,
  };
}

function seed(): void {
  H.setState({
    costEnabled: true,
    costImmortal: false,
    costWindow: 'lifetime',
    costDayKey: undefined,
    costAllotmentUsd: 10_000,
    costCapUsd: 10_000,
    costSpentUsd: 0,
    costEscalatedAt: undefined,
    costStopRequested: false,
    costCeilingUsd: 0,
    costCeilingAllotmentUsd: 0,
    costCeilingHardStop: false,
    codexLedger: {},
    codexUsdCharged: 0,
    codexLedgerBaselinePending: false,
    ledgerGen: 1,
    seenMessageIds: [],
    turnSawMessageUsage: false,
    turnMessageCostUsd: 0,
    turnUnpricedCount: 0,
    turnMissingIdCount: 0,
    turnNoUsageCount: 0,
    claudeBackstop: newBackstopState(0, null, true),
  });
}

/** One report of a call. `cw1h` is the call's (1-hour) cache write. */
function call(
  id: string,
  u: { input?: number; output: number; cacheRead?: number; cw1h?: number; cw5?: number },
  over: Partial<MU> = {},
): MU {
  return {
    type: 'message_usage',
    messageId: id,
    model: OPUS,
    inputTokens: u.input ?? 2,
    outputTokens: u.output,
    cacheReadInputTokens: u.cacheRead ?? 0,
    cacheCreationInputTokens: (u.cw1h ?? 0) + (u.cw5 ?? 0),
    ephemeral1hInputTokens: u.cw1h ?? 0,
    ephemeral5mInputTokens: u.cw5 ?? 0,
    isSubagent: false,
    ...over,
  };
}

function priceOf(
  u: { input?: number; output: number; cacheRead?: number; cw1h?: number; cw5?: number },
  model = OPUS,
): number {
  const v: TokenVec = {
    ...zeroVec(),
    input: u.input ?? 2,
    output: u.output,
    cacheRead: u.cacheRead ?? 0,
    cw1h: u.cw1h ?? 0,
    cw5: u.cw5 ?? 0,
  };
  return priceVec(model, v);
}

/** A `result`'s usage event with cumulative modelUsage (main-loop fields zero — they are not used). */
function result(
  modelUsage: Record<string, { in?: number; out?: number; cr?: number; cw?: number; cost?: number }>,
  over: Partial<UsageEv> = {},
): UsageEv {
  return {
    type: 'usage',
    inputTokens: 0,
    outputTokens: 0,
    cacheCreationInputTokens: 0,
    cacheReadInputTokens: 0,
    ephemeral1hInputTokens: 0,
    ephemeral5mInputTokens: 0,
    durationMs: 0,
    totalCostUsd: 999, // cumulative SDK figure — must never be charged as a turn
    numTurns: 1,
    sessionId: SID,
    modelUsage: Object.fromEntries(
      Object.entries(modelUsage).map(([m, u]) => [
        m,
        {
          inputTokens: u.in ?? 0,
          outputTokens: u.out ?? 0,
          cacheReadInputTokens: u.cr ?? 0,
          cacheCreationInputTokens: u.cw ?? 0,
          costUSD: u.cost ?? 0,
        },
      ]),
    ),
    ...over,
  };
}

function spent(): number {
  return H.getState().costSpentUsd;
}

function ledger(): number {
  return sumWindow(getOutboundDb(), RATE_TABLE, '0000-00-00', '9999-99-99', H.getState().ledgerGen).usd;
}

function ledgerRows(): Array<{ id: string; output_tokens: number; input_tokens: number }> {
  return getOutboundDb()
    .prepare('SELECT id, output_tokens, input_tokens FROM cost_events ORDER BY rowid')
    .all() as Array<{
    id: string;
    output_tokens: number;
    input_tokens: number;
  }>;
}

beforeEach(() => {
  initTestSessionDb();
  __setConfigForTest(cfg());
  __resetCodexCostMemo();
  createCostEventsTable(getOutboundDb());
  seed();
  H.noteClaudeContinuation(SID, true); // a fresh SDK session
});

afterEach(() => {
  __setConfigForTest(null);
  closeSessionDb();
  __resetCodexCostMemo();
});

describe('final per-call usage — charged once, at its final value', () => {
  const SNAP = { output: 8, cacheRead: 419_091, cw1h: 683 };
  const FINAL = { output: 8_178, cacheRead: 419_091, cw1h: 683 };

  it('snapshot blocks then the message_delta final: charges the FINAL once (prod: 8 → 8,178)', () => {
    H.recordMessageCost(call('msg_1', SNAP)); // text block
    H.recordMessageCost(call('msg_1', SNAP)); // tool_use block, same snapshot
    H.recordMessageCost(call('msg_1', FINAL, { final: true }));
    expect(spent()).toBeCloseTo(priceOf(FINAL), 10);
    const rows = ledgerRows();
    expect(rows).toHaveLength(1); // updated in place, not a second row
    expect(rows[0].output_tokens).toBe(8_178);
    expect(ledger()).toBeCloseTo(spent(), 10);
  });

  it('a final that arrives BEFORE a late block is not undone or re-charged', () => {
    H.recordMessageCost(call('msg_1', FINAL, { final: true }));
    H.recordMessageCost(call('msg_1', SNAP));
    expect(spent()).toBeCloseTo(priceOf(FINAL), 10);
  });

  it('a repeated final is a no-op', () => {
    H.recordMessageCost(call('msg_1', SNAP));
    H.recordMessageCost(call('msg_1', FINAL, { final: true }));
    H.recordMessageCost(call('msg_1', FINAL, { final: true }));
    expect(spent()).toBeCloseTo(priceOf(FINAL), 10);
  });

  it('a zero-output call (final == snapshot) is charged exactly once', () => {
    const u = { output: 0, cacheRead: 1_000 };
    H.recordMessageCost(call('msg_z', u));
    H.recordMessageCost(call('msg_z', u, { final: true }));
    expect(spent()).toBeCloseTo(priceOf(u), 12);
  });

  it('thinking-only / tool_use-only / multi-block calls are all one id → one charge each', () => {
    for (const id of ['m_think', 'm_tool', 'm_multi']) {
      const blocks = id === 'm_multi' ? 3 : 1;
      for (let b = 0; b < blocks; b++) H.recordMessageCost(call(id, { output: 3 }));
      H.recordMessageCost(call(id, { output: 300 }, { final: true }));
    }
    expect(spent()).toBeCloseTo(3 * priceOf({ output: 300 }), 10);
    expect(ledger()).toBeCloseTo(spent(), 10);
  });

  it('a fallback / switched model is priced by the model that served each call', () => {
    H.recordMessageCost(call('m_opus', { output: 100 }, { final: true }));
    H.recordMessageCost(call('m_haiku', { output: 100 }, { model: HAIKU, final: true }));
    expect(spent()).toBeCloseTo(priceOf({ output: 100 }) + priceOf({ output: 100 }, HAIKU), 12);
    // The backstop buckets per model too: totals equal to the per-message figures → nothing extra.
    H.recordTurnCost(result({ [OPUS]: { in: 2, out: 100 }, [HAIKU]: { in: 2, out: 100 } }));
    expect(spent()).toBeCloseTo(priceOf({ output: 100 }) + priceOf({ output: 100 }, HAIKU), 12);
  });
});

describe('modelUsage backstop — calls the stream never reports', () => {
  it('charges a helper call (only in modelUsage) once, and not again on the next result', () => {
    H.recordMessageCost(call('m1', { output: 235, cw1h: 23_948 }, { final: true }));
    H.recordTurnCost(result({ [OPUS]: { in: 2, out: 235, cw: 23_948 }, [HAIKU]: { in: 922, out: 12 } }));
    const helper = priceOf({ input: 922, output: 12 }, HAIKU);
    expect(spent()).toBeCloseTo(priceOf({ output: 235, cw1h: 23_948 }) + helper, 12);
    H.recordMessageCost(call('m2', { output: 65 }, { final: true }));
    H.recordTurnCost(result({ [OPUS]: { in: 4, out: 300, cw: 23_948 }, [HAIKU]: { in: 922, out: 12 } }));
    expect(spent()).toBeCloseTo(priceOf({ output: 235, cw1h: 23_948 }) + helper + priceOf({ output: 65 }), 12);
    expect(ledger()).toBeCloseTo(spent(), 10);
  });

  it('charges a compaction call in a resumed session we track, but not the restored history', () => {
    H.recordMessageCost(call('m1', { output: 589, cacheRead: 50_316, cw1h: 26_698, input: 6 }, { final: true }));
    H.recordTurnCost(result({ [OPUS]: { in: 6, out: 589, cr: 50_316, cw: 26_698 } }));
    const before = spent();
    // New query resumes the same session and runs /compact: no stream events, totals jump.
    H.noteClaudeContinuation(SID, false);
    H.recordTurnCost(result({ [OPUS]: { in: 2_042, out: 1_779, cr: 76_684, cw: 26_987 } }));
    const compaction = priceVec(OPUS, { ...zeroVec(), input: 2_036, output: 1_190, cacheRead: 26_368, cw1h: 289 });
    expect(spent() - before).toBeCloseTo(compaction, 12);
    expect(ledger()).toBeCloseTo(spent(), 10);
  });

  it('a resumed session with no tracking state (first run after deploy) ABSORBS its history', () => {
    H.noteClaudeContinuation('sess-old', false);
    H.recordMessageCost(call('m1', { output: 50 }, { final: true }));
    H.recordTurnCost(result({ [OPUS]: { in: 9_000, out: 400_000, cr: 9e7, cw: 9e5 } }, { sessionId: 'sess-old' }));
    expect(spent()).toBeCloseTo(priceOf({ output: 50 }), 12); // only what this query streamed
  });

  it('a PARTIAL restore never double-counts', () => {
    H.recordMessageCost(call('m1', { output: 500 }, { final: true }));
    H.recordTurnCost(result({ [OPUS]: { in: 2, out: 500 } }));
    H.noteClaudeContinuation(SID, false);
    H.recordMessageCost(call('m2', { output: 30 }, { final: true }));
    H.recordTurnCost(result({ [OPUS]: { in: 2, out: 30 } })); // restore lost the 500
    expect(spent()).toBeCloseTo(priceOf({ output: 500 }) + priceOf({ output: 30 }), 12);
  });

  it('a zeroed error result is skipped and does not rebase (no re-charge of history afterwards)', () => {
    H.recordMessageCost(call('m1', { output: 500 }, { final: true }));
    H.recordTurnCost(result({ [OPUS]: { in: 2, out: 500 } }));
    H.recordTurnCost(result({ [OPUS]: { in: 0, out: 0 } }, { isError: true }));
    H.noteClaudeContinuation(SID, false);
    H.recordTurnCost(result({ [OPUS]: { in: 2, out: 500 } })); // restored total, nothing new
    expect(spent()).toBeCloseTo(priceOf({ output: 500 }), 12);
  });

  it('an SDK max-budget stop (error result WITH totals) still settles its off-stream spend', () => {
    H.recordMessageCost(call('m1', { output: 100 }, { final: true }));
    H.recordTurnCost(result({ [OPUS]: { in: 2, out: 100 }, [HAIKU]: { in: 500, out: 5 } }, { isError: true }));
    expect(spent()).toBeCloseTo(priceOf({ output: 100 }) + priceOf({ input: 500, output: 5 }, HAIKU), 12);
  });

  it('never charges the cumulative totalCostUsd as one turn (the old degraded path)', () => {
    H.recordMessageCost(call(null as unknown as string, { output: 100 }, { messageId: null }));
    H.recordTurnCost(result({ [OPUS]: { in: 2, out: 100 } })); // totalCostUsd = 999 in the helper
    expect(spent()).toBeCloseTo(priceOf({ output: 100 }), 12); // the id-less call, via the backstop
  });

  it('an unpriced model is charged from the SDK cost figure', () => {
    H.recordMessageCost(call('m_new', { output: 100 }, { model: 'claude-future-9', final: true }));
    expect(spent()).toBe(0);
    H.recordTurnCost(result({ 'claude-future-9': { in: 2, out: 100, cost: 0.42 } }));
    expect(spent()).toBeCloseTo(0.42, 12);
    expect(ledger()).toBeCloseTo(spent(), 10);
  });
});

describe('subagents — final usage from the transcript, never double-counted', () => {
  const SNAP = { output: 6, cw5: 15_691, cacheRead: 6_379 };
  const FINAL = { output: 124, cw5: 15_691, cacheRead: 6_379 };

  it('sync subagent: snapshot then transcript final before the result → charged once, backstop adds nothing', () => {
    H.recordMessageCost(call('sub_1', SNAP, { isSubagent: true }));
    H.recordMessageCost(call('sub_1', FINAL, { isSubagent: true, final: true, callTs: new Date().toISOString() }));
    H.recordTurnCost(result({ [OPUS]: { in: 2, out: 124, cr: 6_379, cw: 15_691 } }));
    expect(spent()).toBeCloseTo(priceOf(FINAL), 12);
    expect(ledger()).toBeCloseTo(spent(), 10);
  });

  it('background subagent: result counted the call, transcript final arrives AFTER → consumes credit, no double count', () => {
    H.recordMessageCost(call('sub_bg', SNAP, { isSubagent: true }));
    H.recordTurnCost(result({ [OPUS]: { in: 2, out: 124, cr: 6_379, cw: 15_691 } })); // residual: 118 output
    expect(spent()).toBeCloseTo(priceOf(FINAL), 12);
    H.recordMessageCost(call('sub_bg', FINAL, { isSubagent: true, final: true, callTs: new Date().toISOString() }));
    expect(spent()).toBeCloseTo(priceOf(FINAL), 12); // unchanged: the residual already paid it
    expect(ledger()).toBeCloseTo(spent(), 10); // residual row shrank as the message row grew
    // And the next result does not charge it again.
    H.recordTurnCost(result({ [OPUS]: { in: 2, out: 124, cr: 6_379, cw: 15_691 } }));
    expect(spent()).toBeCloseTo(priceOf(FINAL), 12);
  });

  it('background subagent whose call completes after the result: charged when its final arrives', () => {
    H.recordTurnCost(result({ [OPUS]: { in: 0, out: 0 } })); // turn ends, subagent still running
    H.recordMessageCost(call('sub_late', SNAP, { isSubagent: true }));
    H.recordMessageCost(
      call('sub_late', FINAL, { isSubagent: true, final: true, callTs: new Date(Date.now() + 1000).toISOString() }),
    );
    expect(spent()).toBeCloseTo(priceOf(FINAL), 12);
    H.recordTurnCost(result({ [OPUS]: { in: 2, out: 124, cr: 6_379, cw: 15_691 } }));
    expect(spent()).toBeCloseTo(priceOf(FINAL), 12);
    expect(ledger()).toBeCloseTo(spent(), 10);
  });

  it('a transcript call never seen on the stream, dated before the last result, consumes credit', () => {
    H.recordTurnCost(result({ [OPUS]: { in: 2, out: 124, cr: 6_379, cw: 15_691 } })); // SDK counted it
    H.recordMessageCost(
      call('sub_unseen', FINAL, { isSubagent: true, final: true, callTs: '2000-01-01T00:00:00.000Z' }),
    );
    expect(spent()).toBeCloseTo(priceOf(FINAL), 12); // once, via the residual
    expect(ledger()).toBeCloseTo(spent(), 10);
  });
});

describe('aborts, resets and respawn', () => {
  it('an aborted turn keeps what streamed, and its resumed result does not re-charge it', () => {
    H.recordMessageCost(call('m1', { output: 100 }, { final: true }));
    H.recordTurnCost(result({ [OPUS]: { in: 2, out: 100 } }));
    H.recordMessageCost(call('m_aborted', { output: 7 })); // snapshot only — the turn died mid-call
    H.resetTurnAccountingState(); // the next query's defensive reset
    H.noteClaudeContinuation(SID, false);
    H.recordMessageCost(call('m3', { output: 50 }, { final: true }));
    // Restored totals include the aborted call's real (final) usage.
    H.recordTurnCost(result({ [OPUS]: { in: 6, out: 100 + 400 + 50 } }));
    // m_aborted was charged its snapshot (7 out); the resumed totals carry its
    // real 400 — the backstop charges the missing 393 and nothing else.
    expect(spent()).toBeCloseTo(priceOf({ output: 100 }) + priceOf({ output: 400 }) + priceOf({ output: 50 }), 10);
    expect(ledger()).toBeCloseTo(spent(), 10);
  });

  it('a /clear window reset absorbs the pre-reset history on the next result', () => {
    H.recordMessageCost(call('m1', { output: 100 }, { final: true }));
    H.recordTurnCost(result({ [OPUS]: { in: 2, out: 100 } }));
    H.resetCostForNewSession();
    expect(spent()).toBe(0);
    H.recordMessageCost(call('m2', { output: 10 }, { final: true }));
    H.recordTurnCost(result({ [OPUS]: { in: 4, out: 110 } }));
    expect(spent()).toBeCloseTo(priceOf({ output: 10 }), 12);
  });

  it('respawn: the backstop baseline survives initCostTracking', () => {
    H.recordMessageCost(call('m1', { output: 100 }, { final: true }));
    H.recordTurnCost(result({ [OPUS]: { in: 2, out: 100 }, [HAIKU]: { in: 900, out: 10 } }));
    const before = spent();
    H.initCostTracking('claude'); // a new container adopting the persisted state
    expect(H.getState().claudeBackstop.sessionId).toBe(SID);
    H.noteClaudeContinuation(SID, false);
    H.recordMessageCost(call('m2', { output: 20 }, { final: true }));
    H.recordTurnCost(result({ [OPUS]: { in: 4, out: 120 }, [HAIKU]: { in: 1_800, out: 20 } }));
    expect(spent() - before).toBeCloseTo(priceOf({ output: 20 }) + priceOf({ input: 900, output: 10 }, HAIKU), 10);
  });
});
