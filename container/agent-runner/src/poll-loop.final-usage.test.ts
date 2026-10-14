/**
 * Exact Claude accounting in the live counter: final per-call usage, the
 * per-query segment backstop against the SDK's cumulative `modelUsage`, and the
 * transaction that commits each accounting event (claude-usage.ts,
 * recordMessageCost, settleClaudeTurn, beginClaudeSegment, runCostEvent).
 *
 * THE BUG THIS PINS. The SDK streams each content block of a call as its own
 * assistant message, all carrying the `message_start` SNAPSHOT — final input
 * and cache, but `output_tokens` of 1–30. #1329 charged the first block of each
 * id and ignored the rest, so the counter (and the cost_events ledger) kept ~1%
 * of output tokens: on prod session sess-1785902924001-jylfb4 a call the
 * transcript and the OneCLI gateway both record as 8,178 output tokens was
 * charged as 8. Calls the stream never shows were not charged at all —
 * slang-triager's isolated compaction calls alone were 15.7% of its spend.
 *
 * Every case asserts BOTH the counter and that the ledger sums to it — the
 * ledger is what the gateway acceptance check compares against prod billing,
 * and it is the durable per-message dedup record.
 *
 * Same convention as poll-loop.message-cost.test.ts: no module mocks, a real
 * in-memory session DB, real pricing.
 */
import { describe, it, expect, beforeEach, afterEach, setSystemTime } from 'bun:test';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { closeSessionDb, getInboundDb, getOutboundDb, initTestSessionDb } from './mailbox/sqlite/connection.js';
import { getClaudeBackstop, getCostCap } from './db/session-state.js';
import { __setConfigForTest } from './config.js';
import { __costCapTestHooks as H, processQuery } from './poll-loop.js';
import { __resetCodexCostMemo } from './codex-cost.js';
import { createCostEventsTable, loadClaudeMessage, sumWindow } from './cost-events.js';
import { RATE_TABLE } from './cost-rate-table.js';
import { newBackstopState, priceVec, zeroVec, type TokenVec } from './claude-usage.js';
import type { RunnerConfig } from './config.js';
import type { AgentQuery, ProviderEvent, UsageAccounting } from './providers/types.js';

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
    ledgerBaselineVersion: 1,
    seenMessageIds: [],
    turnSawMessageUsage: false,
    turnMessageCostUsd: 0,
    turnUnpricedCount: 0,
    turnMissingIdCount: 0,
    turnNoUsageCount: 0,
    claudeBackstop: newBackstopState(),
  });
  H.setFailPoint(undefined);
}

/** One report of a call. */
function call(
  id: string | null,
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

type MUIn = Record<string, { in?: number; out?: number; cr?: number; cw?: number; cost?: number }>;

function modelUsage(mu: MUIn): NonNullable<UsageEv['modelUsage']> {
  return Object.fromEntries(
    Object.entries(mu).map(([m, u]) => [
      m,
      {
        inputTokens: u.in ?? 0,
        outputTokens: u.out ?? 0,
        cacheReadInputTokens: u.cr ?? 0,
        cacheCreationInputTokens: u.cw ?? 0,
        costUSD: u.cost ?? 0,
      },
    ]),
  );
}

/** A `result`'s accounting with cumulative modelUsage (main-loop fields unused). */
function result(mu: MUIn, over: Partial<UsageEv> = {}): UsageEv {
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
    modelUsage: modelUsage(mu),
    ...over,
  };
}

const spent = () => H.getState().costSpentUsd;
const ledger = () => sumWindow(getOutboundDb(), RATE_TABLE, '0000-00-00', '9999-99-99', H.getState().ledgerGen).usd;
const ledgerRows = () =>
  getOutboundDb().prepare('SELECT * FROM cost_events ORDER BY rowid').all() as Array<Record<string, number | string>>;
/** A call's durable state: its base row plus its append-only corrections. */
const message = (id: string) => loadClaudeMessage(getOutboundDb(), `claude:1:${id}`);

/** Everything durable an accounting event may touch. */
function durable() {
  return JSON.stringify({
    cap: getCostCap()?.spentUsd ?? 0,
    backstop: getClaudeBackstop() ?? null,
    rows: ledgerRows(),
  });
}

/** A query start: a fresh SDK session, or a resume with what the SDK will restore. */
function freshQuery(sid = SID): void {
  H.beginClaudeSegment(undefined, null);
  H.noteClaudeContinuation(sid, true);
}
function resumeQuery(restored: MUIn | null, sid = SID): void {
  H.beginClaudeSegment(sid, restored ? modelUsage(restored) : null);
  H.noteClaudeContinuation(sid, false);
}

let codexHome: string;
let prevCodexHome: string | undefined;

beforeEach(() => {
  // The result-time settlement folds codex rollouts: point it at an empty home.
  codexHome = fs.mkdtempSync(path.join(os.tmpdir(), 'finalusage-codex-'));
  prevCodexHome = process.env.CODEX_HOME;
  process.env.CODEX_HOME = codexHome;
  initTestSessionDb();
  __setConfigForTest(cfg());
  __resetCodexCostMemo();
  createCostEventsTable(getOutboundDb());
  seed();
  freshQuery();
});

afterEach(() => {
  H.setFailPoint(undefined);
  __setConfigForTest(null);
  closeSessionDb();
  __resetCodexCostMemo();
  if (prevCodexHome === undefined) delete process.env.CODEX_HOME;
  else process.env.CODEX_HOME = prevCodexHome;
  fs.rmSync(codexHome, { recursive: true, force: true });
});

describe('final per-call usage — charged once, at its final value', () => {
  const SNAP = { output: 8, cacheRead: 419_091, cw1h: 683 };
  const FINAL = { output: 8_178, cacheRead: 419_091, cw1h: 683 };

  it('snapshot blocks then the message_delta final: charges the FINAL once (prod: 8 → 8,178)', () => {
    H.recordMessageCost(call('msg_1', SNAP));
    H.recordMessageCost(call('msg_1', SNAP));
    H.recordMessageCost(call('msg_1', FINAL, { final: true }));
    expect(spent()).toBeCloseTo(priceOf(FINAL), 10);
    // Append-only: the base row keeps the snapshot, one correction row adds the rest.
    expect(ledgerRows().map((r) => r.output_tokens)).toEqual([8, 8_170]);
    expect(message('msg_1')?.event.outputTokens).toBe(8_178);
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

  it('an unsplit snapshot then an equal 1h-split final re-prices the write at 1h', () => {
    H.recordMessageCost({ ...call('m_ttl', { output: 1 }), cacheCreationInputTokens: 1_000 }); // flat
    H.recordMessageCost(call('m_ttl', { output: 1, cw1h: 1_000 }, { final: true }));
    expect(spent()).toBeCloseTo(priceOf({ output: 1, cw1h: 1_000 }), 12);
    expect(ledger()).toBeCloseTo(spent(), 12);
  });
});

describe('model of a call — priced by the model that served it (item 5)', () => {
  it('a model-less snapshot priced as the configured model MOVES to the model the final names', () => {
    H.recordMessageCost(call('m1', { output: 5 }, { model: undefined }));
    expect(spent()).toBeCloseTo(priceOf({ output: 5 }), 12); // configured Opus
    H.recordMessageCost(call('m1', { output: 300 }, { model: HAIKU, final: true }));
    expect(spent()).toBeCloseTo(priceOf({ output: 300 }, HAIKU), 12); // the Opus guess is refunded
    expect(message('m1')?.model).toBe(HAIKU);
    expect(message('m1')?.event.outputTokens).toBe(300);
    // The SDK puts the call under Haiku; nothing is charged twice.
    H.recordTurnCost(result({ [HAIKU]: { in: 2, out: 300 } }));
    expect(spent()).toBeCloseTo(priceOf({ output: 300 }, HAIKU), 12);
    expect(ledger()).toBeCloseTo(spent(), 12);
  });

  it('a fallback / switched model is priced per call and settled per model', () => {
    H.recordMessageCost(call('m_opus', { output: 100 }, { final: true }));
    H.recordMessageCost(call('m_haiku', { output: 100 }, { model: HAIKU, final: true }));
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

  it('never charges the cumulative totalCostUsd as one turn (the old degraded path)', () => {
    H.recordMessageCost(call(null, { output: 100 }));
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

  it('an SDK max-budget stop (error result WITH totals) still settles its off-stream spend', () => {
    H.recordMessageCost(call('m1', { output: 100 }, { final: true }));
    H.recordTurnCost(result({ [OPUS]: { in: 2, out: 100 }, [HAIKU]: { in: 500, out: 5 } }, { isError: true }));
    expect(spent()).toBeCloseTo(priceOf({ output: 100 }) + priceOf({ input: 500, output: 5 }, HAIKU), 12);
  });

  it('a zeroed error result is skipped and keeps the baseline', () => {
    H.recordMessageCost(call('m1', { output: 500 }, { final: true }));
    H.recordTurnCost(result({ [OPUS]: { in: 2, out: 500 } }));
    H.recordTurnCost(result({ [OPUS]: { in: 0, out: 0 } }, { isError: true }));
    H.recordTurnCost(result({ [OPUS]: { in: 2, out: 520 } }));
    expect(spent()).toBeCloseTo(priceOf({ output: 500 }) + priceOf({ input: 0, output: 20 }), 12);
  });
});

describe('resume baselines — established BEFORE the query (item 4)', () => {
  // The prod shape of an isolated compaction: ~245K uncached input, ~525K cache write, ~6K output.
  const COMPACTION = { input: 245_000, output: 6_000, cw5: 525_000 };
  const BEFORE: MUIn = { [OPUS]: { in: 6, out: 589, cr: 50_316, cw: 26_698 } };
  const AFTER: MUIn = { [OPUS]: { in: 6 + 245_000, out: 589 + 6_000, cr: 50_316, cw: 26_698 + 525_000 } };

  it('from the transcript cost-state: a compaction in the FIRST turn of a resumed query is charged', () => {
    H.setState({ claudeBackstop: newBackstopState() }); // first run after deploy: no earlier segment
    resumeQuery(BEFORE);
    H.recordTurnCost(result(AFTER));
    expect(spent()).toBeCloseTo(priceVec(OPUS, { ...zeroVec(), ...COMPACTION }), 10);
    expect(ledger()).toBeCloseTo(spent(), 10);
  });

  it('from the checkpoint of the previous process when the transcript has none', () => {
    H.recordMessageCost(call('m1', { input: 6, output: 589, cacheRead: 50_316, cw1h: 26_698 }, { final: true }));
    H.recordTurnCost(result(BEFORE)); // checkpoint saved
    const before = spent();
    resumeQuery(null); // no transcript cost-state readable
    H.recordTurnCost(result(AFTER));
    expect(spent() - before).toBeCloseTo(
      priceVec(OPUS, { ...zeroVec(), input: 245_000, output: 6_000, cw1h: 525_000 }),
      10,
    );
  });

  it('absorbs ONLY with no baseline at all — the restored history is never charged', () => {
    resumeQuery(null, 'sess-never-seen');
    H.recordMessageCost(call('m1', { output: 50 }, { final: true }));
    H.recordTurnCost(
      result({ [OPUS]: { in: 9_000, out: 400_000, cr: 9e7, cw: 9e5 } }, { sessionId: 'sess-never-seen' }),
    );
    expect(spent()).toBeCloseTo(priceOf({ output: 50 }), 12);
    expect(getClaudeBackstop()).toMatchObject({ segment: { baseSource: 'absorb' } });
  });

  it('a restore SMALLER than the baseline (killed process) restarts accounting — no masking, no double count (item 3)', () => {
    H.recordMessageCost(call('m1', { output: 500 }, { final: true }));
    H.recordTurnCost(result({ [OPUS]: { in: 2, out: 500 } }));
    resumeQuery(null); // checkpoint says 500, but the SDK restores less
    H.recordMessageCost(call('m2', { output: 30 }, { final: true }));
    H.recordTurnCost(result({ [OPUS]: { in: 2, out: 50 } })); // 0 restored + 30 streamed + 20 helper
    const afterReset = spent();
    expect(afterReset).toBeCloseTo(priceOf({ output: 500 }) + priceOf({ output: 30 }), 12);
    // The next helper call is charged in full — the old 500 cannot mask it.
    H.recordTurnCost(result({ [OPUS]: { in: 2, out: 70 } }));
    expect(spent() - afterReset).toBeCloseTo(priceOf({ input: 0, output: 20 }), 12);
  });

  it('an aborted turn keeps what streamed; the next query differences against the restored totals', () => {
    H.recordMessageCost(call('m1', { output: 100 }, { final: true }));
    H.recordTurnCost(result({ [OPUS]: { in: 2, out: 100 } }));
    H.recordMessageCost(call('m_aborted', { output: 7 })); // the process died mid-call
    // The dead process saved no cost-state: the SDK restores the last one (100).
    resumeQuery({ [OPUS]: { in: 2, out: 100 } });
    H.recordMessageCost(call('m3', { output: 50 }, { final: true }));
    H.recordTurnCost(result({ [OPUS]: { in: 4, out: 150 } }));
    expect(spent()).toBeCloseTo(priceOf({ output: 100 }) + priceOf({ output: 7 }) + priceOf({ output: 50 }), 10);
    expect(ledger()).toBeCloseTo(spent(), 10);
  });

  it('a /clear window reset: the fresh query after it starts from zero, history never re-charged', () => {
    H.recordMessageCost(call('m1', { output: 100 }, { final: true }));
    H.recordTurnCost(result({ [OPUS]: { in: 2, out: 100 } }));
    H.resetCostForNewSession();
    expect(spent()).toBe(0);
    freshQuery('sess-B');
    H.recordMessageCost(call('m2', { output: 10 }, { final: true }));
    H.recordTurnCost(result({ [OPUS]: { in: 2, out: 10 } }, { sessionId: 'sess-B' }));
    expect(spent()).toBeCloseTo(priceOf({ output: 10 }), 12);
  });
});

describe('subagents — final usage from the transcript, never double-counted', () => {
  const SNAP = { output: 6, cw5: 15_691, cacheRead: 6_379 };
  const FINAL = { output: 124, cw5: 15_691, cacheRead: 6_379 };
  const SDK_COUNTS_IT: MUIn = { [OPUS]: { in: 2, out: 124, cr: 6_379, cw: 15_691 } };

  it('sync subagent: snapshot then transcript final before the result → charged once', () => {
    H.recordMessageCost(call('sub_1', SNAP, { isSubagent: true }));
    H.recordMessageCost(call('sub_1', FINAL, { isSubagent: true, final: true, callTs: new Date().toISOString() }));
    H.recordTurnCost(result(SDK_COUNTS_IT));
    expect(spent()).toBeCloseTo(priceOf(FINAL), 12);
    expect(ledger()).toBeCloseTo(spent(), 10);
  });

  it('background subagent: result counted the call, transcript final arrives AFTER → consumes credit', () => {
    H.recordMessageCost(call('sub_bg', SNAP, { isSubagent: true }));
    H.recordTurnCost(result(SDK_COUNTS_IT)); // residual: 118 output
    expect(spent()).toBeCloseTo(priceOf(FINAL), 12);
    H.recordMessageCost(call('sub_bg', FINAL, { isSubagent: true, final: true, callTs: new Date().toISOString() }));
    expect(spent()).toBeCloseTo(priceOf(FINAL), 12);
    expect(ledger()).toBeCloseTo(spent(), 10); // residual row shrank exactly as the message row grew
    H.recordTurnCost(result(SDK_COUNTS_IT));
    expect(spent()).toBeCloseTo(priceOf(FINAL), 12);
  });

  it('background subagent whose call completes after the result: charged when its final arrives', () => {
    H.recordTurnCost(result({ [OPUS]: { in: 0, out: 0 } }));
    H.recordMessageCost(call('sub_late', SNAP, { isSubagent: true }));
    H.recordMessageCost(
      call('sub_late', FINAL, { isSubagent: true, final: true, callTs: new Date(Date.now() + 1_000).toISOString() }),
    );
    expect(spent()).toBeCloseTo(priceOf(FINAL), 12);
    H.recordTurnCost(result(SDK_COUNTS_IT));
    expect(spent()).toBeCloseTo(priceOf(FINAL), 12);
    expect(ledger()).toBeCloseTo(spent(), 10);
  });

  it('a transcript call never seen on the stream, dated before the last result, consumes credit (all fields)', () => {
    H.recordTurnCost(result(SDK_COUNTS_IT));
    H.recordMessageCost(
      call('sub_unseen', FINAL, { isSubagent: true, final: true, callTs: '2000-01-01T00:00:00.000Z' }),
    );
    expect(spent()).toBeCloseTo(priceOf(FINAL), 12);
    expect(ledger()).toBeCloseTo(spent(), 10);
  });
});

describe('durable dedup across a respawn (item 2)', () => {
  const SNAP = { output: 6, cw5: 15_691 };
  const FINAL = { output: 124, cw5: 15_691 };

  function respawn(): void {
    H.forgetChargedMessages(); // a new container: no in-memory state
    H.initCostTracking('claude'); // reload spend + backstop from the DB
  }

  it('a re-fired SubagentStop after a respawn tops up from the ledger row, never re-charges', () => {
    H.recordMessageCost(call('sub_x', SNAP, { isSubagent: true }));
    respawn();
    H.recordMessageCost(call('sub_x', FINAL, { isSubagent: true, final: true, callTs: new Date().toISOString() }));
    expect(spent()).toBeCloseTo(priceOf(FINAL), 12);
    respawn();
    H.recordMessageCost(call('sub_x', FINAL, { isSubagent: true, final: true, callTs: new Date().toISOString() }));
    expect(spent()).toBeCloseTo(priceOf(FINAL), 12);
    expect(message('sub_x')?.event.outputTokens).toBe(124);
  });

  it('an earlier process that died BEFORE settling the call: its final is topped up directly (round-2 item 2)', () => {
    H.recordMessageCost(call('sub_y', SNAP, { isSubagent: true })); // no result settled after it
    respawn();
    resumeQuery(null); // the new process's query
    H.recordMessageCost(call('sub_y', FINAL, { isSubagent: true, final: true }));
    expect(spent()).toBeCloseTo(priceOf(FINAL), 12);
    H.recordMessageCost(call('sub_y', FINAL, { isSubagent: true, final: true })); // and only once
    expect(spent()).toBeCloseTo(priceOf(FINAL), 12);
    expect(ledger()).toBeCloseTo(spent(), 12);
  });

  it('an earlier process that DID settle a result after the call: its own settlement owned it', () => {
    H.recordMessageCost(call('sub_z', SNAP, { isSubagent: true }));
    H.recordTurnCost(result({ [OPUS]: { in: 2, out: 124, cw: 15_691 } })); // the SDK counted the final; residual paid
    const paid = spent();
    expect(paid).toBeCloseTo(priceOf(FINAL), 12);
    respawn();
    resumeQuery(null);
    H.recordMessageCost(call('sub_z', FINAL, { isSubagent: true, final: true }));
    expect(spent()).toBeCloseTo(paid, 12);
  });
});

describe('atomicity — failure injected at every statement boundary (items 1, 2, 9)', () => {
  const SNAP = { output: 6, cw5: 15_691, cacheRead: 6_379 };
  const FINAL = { output: 124, cw5: 15_691, cacheRead: 6_379 };

  // A late final that rewrites its message row AND consumes residual rows — the
  // longest write path.
  function setUpLateFinal(): MU {
    H.recordMessageCost(call('sub_bg', SNAP, { isSubagent: true }));
    H.recordTurnCost(result({ [OPUS]: { in: 2, out: 124, cr: 6_379, cw: 15_691 } }));
    return call('sub_bg', FINAL, { isSubagent: true, final: true, callTs: new Date().toISOString() });
  }

  for (const point of ['msg:after-mutate', 'msg:after-ledger-row', 'msg:after-residual', 'msg:after-spend']) {
    it(`message event failing at ${point}: nothing durable changes, memory matches, the retry charges once`, () => {
      const ev = setUpLateFinal();
      const before = durable();
      const mem = spent();
      H.setFailPoint(point);
      H.recordMessageCost(ev);
      expect(durable()).toBe(before);
      expect(spent()).toBe(mem);
      expect(H.pendingCostEventCount()).toBe(1);
      H.setFailPoint(undefined);
      H.flushPendingCostEvents();
      expect(H.pendingCostEventCount()).toBe(0);
      expect(spent()).toBeCloseTo(priceOf(FINAL), 12);
      expect(ledger()).toBeCloseTo(spent(), 10);
      expect(getCostCap()?.spentUsd).toBeCloseTo(spent(), 12);
    });

    it(`message event failing at ${point} then a CRASH: the redelivered report charges once`, () => {
      const ev = setUpLateFinal();
      H.setFailPoint(point);
      H.recordMessageCost(ev);
      H.setFailPoint(undefined);
      H.setState({ seenMessageIds: [] }); // the crash: memory and the retry queue are gone
      H.initCostTracking('claude');
      H.recordMessageCost(ev);
      H.recordMessageCost(ev);
      expect(spent()).toBeCloseTo(priceOf(FINAL), 12);
      expect(ledger()).toBeCloseTo(spent(), 10);
    });
  }

  for (const point of ['settle:after-mutate', 'settle:after-ledger', 'settle:after-spend']) {
    it(`settlement failing at ${point}: rolled back whole, retried once`, () => {
      H.recordMessageCost(call('m1', { output: 100 }, { final: true }));
      const before = durable();
      H.setFailPoint(point);
      H.recordTurnCost(
        result({ [OPUS]: { in: 2, out: 100 }, [HAIKU]: { in: 900, out: 10 }, 'claude-future-9': { cost: 0.5 } }),
      );
      expect(durable()).toBe(before);
      expect(H.pendingCostEventCount()).toBe(1);
      H.setFailPoint(undefined);
      H.recordMessageCost(call('m2', { output: 1 }, { final: true })); // the next event flushes the queue first
      expect(spent()).toBeCloseTo(
        priceOf({ output: 100 }) + priceOf({ input: 900, output: 10 }, HAIKU) + 0.5 + priceOf({ output: 1 }),
        10,
      );
      expect(ledger()).toBeCloseTo(spent(), 10);
    });
  }

  it('a failed segment start is retried before the next event', () => {
    H.setState({ claudeBackstop: newBackstopState() }); // no earlier segment to close
    H.setFailPoint('segment:after-start');
    resumeQuery({ [OPUS]: { in: 2, out: 100 } });
    H.setFailPoint(undefined);
    H.recordTurnCost(result({ [OPUS]: { in: 2, out: 130 } }));
    expect(spent()).toBeCloseTo(priceOf({ input: 0, output: 30 }), 12);
  });

  it('a ceiling escalation is written only after its charge commits', () => {
    seed();
    H.setState({ costCeilingUsd: 0.001, costCeilingAllotmentUsd: 0.001 });
    freshQuery();
    H.setFailPoint('msg:after-spend');
    H.recordMessageCost(call('m1', { output: 1_000 }, { final: true }));
    const escalations = () =>
      getOutboundDb()
        .prepare("SELECT COUNT(*) AS n FROM messages_out WHERE content LIKE '%cost_escalation%'")
        .get() as {
        n: number;
      };
    expect(escalations().n).toBe(0);
    expect(H.getState().costStopRequested).toBe(false);
    H.setFailPoint(undefined);
    H.flushPendingCostEvents();
    expect(H.getState().costStopRequested).toBe(true);
    expect(escalations().n).toBe(1);
  });
});

describe('result accounting is settled before result handling (item 6)', () => {
  function queryWith(events: ProviderEvent[]): AgentQuery {
    return {
      push() {},
      end() {},
      abort() {},
      events: {
        async *[Symbol.asyncIterator]() {
          for (const e of events) yield e;
        },
      },
    };
  }
  const acc: UsageAccounting = {
    inputTokens: 0,
    outputTokens: 0,
    cacheCreationInputTokens: 0,
    cacheReadInputTokens: 0,
    ephemeral1hInputTokens: 0,
    ephemeral5mInputTokens: 0,
    durationMs: 0,
    totalCostUsd: 0,
    numTurns: 1,
    sessionId: SID,
    modelUsage: modelUsage({ [OPUS]: { in: 2, out: 100 }, [HAIKU]: { in: 900, out: 10 } }),
  };
  const routing = {
    platformId: 'dashboard:admin',
    channelType: 'dashboard' as const,
    threadId: null,
    inReplyTo: undefined,
    taskRun: false,
  };

  it('the residual is already charged when the result branch runs, even with no usage event after it', async () => {
    getInboundDb()
      .prepare(
        `INSERT INTO messages_in (id, kind, timestamp, status, content, seq) VALUES ('q1','chat',?, 'pending', ?, 2)`,
      )
      .run(new Date().toISOString(), JSON.stringify({ sender: 'admin', text: 'hi' }));
    let spentInResultBranch = -1;
    await processQuery(
      queryWith([
        { type: 'init', continuation: SID },
        call('m1', { output: 100 }, { final: true }),
        { type: 'result', text: 'done', accounting: acc },
      ]),
      routing,
      ['q1'],
      'claude',
      () => {
        spentInResultBranch = spent();
      },
      'hi',
    );
    const expected = priceOf({ output: 100 }) + priceOf({ input: 900, output: 10 }, HAIKU);
    expect(spentInResultBranch).toBeCloseTo(expected, 12);
    expect(spent()).toBeCloseTo(expected, 12);
  });

  it('a usage event after a settled result does not settle twice', async () => {
    getInboundDb()
      .prepare(
        `INSERT INTO messages_in (id, kind, timestamp, status, content, seq) VALUES ('q2','chat',?, 'pending', ?, 2)`,
      )
      .run(new Date().toISOString(), JSON.stringify({ sender: 'admin', text: 'hi' }));
    await processQuery(
      queryWith([
        { type: 'init', continuation: SID },
        call('m1', { output: 100 }, { final: true }),
        { type: 'result', text: 'done', accounting: acc },
        { type: 'usage', ...acc },
      ]),
      routing,
      ['q2'],
      'claude',
      undefined,
      'hi',
    );
    expect(spent()).toBeCloseTo(priceOf({ output: 100 }) + priceOf({ input: 900, output: 10 }, HAIKU), 12);
  });
});

describe("round 3 — closing a segment settles it against its session's final cost-state", () => {
  function respawn(): void {
    H.forgetChargedMessages();
    H.initCostTracking('claude');
  }

  it('a process that died mid-call: the next query charges the final it never read (R3-2)', () => {
    H.recordMessageCost(call('m1', { output: 7 })); // snapshot only, then the process dies
    respawn();
    // Claude Code wrote the call's final into the cost-state as it exited.
    resumeQuery({ [OPUS]: { in: 2, out: 1_000 } });
    expect(spent()).toBeCloseTo(priceOf({ output: 1_000 }), 12);
    expect(ledger()).toBeCloseTo(spent(), 12);
    // The new segment starts from that total: only its own calls count.
    H.recordMessageCost(call('m2', { output: 50 }, { final: true }));
    H.recordTurnCost(result({ [OPUS]: { in: 4, out: 1_050 } }));
    expect(spent()).toBeCloseTo(priceOf({ output: 1_000 }) + priceOf({ output: 50 }), 12);
    // A late report for the dead process's call is covered by that settlement.
    H.recordMessageCost(call('m1', { output: 1_000 }, { final: true }));
    expect(spent()).toBeCloseTo(priceOf({ output: 1_000 }) + priceOf({ output: 50 }), 12);
    expect(ledger()).toBeCloseTo(spent(), 12);
  });

  it('a settlement that never committed before a restart is recovered at the next query start (R3-1)', () => {
    H.recordMessageCost(call('m1', { output: 100 }, { final: true }));
    H.setFailPoint('settle:after-spend');
    H.recordTurnCost(result({ [OPUS]: { in: 2, out: 100 }, [HAIKU]: { in: 900, out: 10 } }));
    H.setFailPoint(undefined);
    H.setState({ seenMessageIds: [] }); // the restart: memory and the retry queue are gone
    respawn();
    resumeQuery({ [OPUS]: { in: 2, out: 100 }, [HAIKU]: { in: 900, out: 10 } });
    expect(spent()).toBeCloseTo(priceOf({ output: 100 }) + priceOf({ input: 900, output: 10 }, HAIKU), 12);
    expect(ledger()).toBeCloseTo(spent(), 12);
  });

  it('a normal end settles nothing more: the cost-state equals the last result (no double count)', () => {
    H.recordMessageCost(call('m1', { output: 100 }, { final: true }));
    H.recordTurnCost(result({ [OPUS]: { in: 2, out: 100 }, [HAIKU]: { in: 900, out: 10 } }));
    const paid = spent();
    resumeQuery({ [OPUS]: { in: 2, out: 100 }, [HAIKU]: { in: 900, out: 10 } });
    expect(spent()).toBeCloseTo(paid, 12);
    expect(ledger()).toBeCloseTo(paid, 12);
  });

  it('a background subagent that finished after the last result is settled when the query is replaced', () => {
    H.recordMessageCost(call('m1', { output: 100 }, { final: true }));
    H.recordTurnCost(result({ [OPUS]: { in: 2, out: 100 } }));
    H.recordMessageCost(call('sub_bg', { output: 6 }, { isSubagent: true })); // its final was never read
    resumeQuery({ [OPUS]: { in: 4, out: 224 } });
    expect(spent()).toBeCloseTo(priceOf({ output: 100 }) + priceOf({ output: 124 }), 12);
    expect(ledger()).toBeCloseTo(spent(), 12);
  });

  it("a fresh next query reads the replaced session's own final cost-state", () => {
    H.recordMessageCost(call('m1', { output: 7 }));
    H.beginClaudeSegment(undefined, null, (sid) =>
      sid === SID ? modelUsage({ [OPUS]: { in: 2, out: 1_000 } }) : null,
    );
    H.noteClaudeContinuation('sess-B', true);
    expect(spent()).toBeCloseTo(priceOf({ output: 1_000 }), 12);
  });

  it('a cost-state OLDER than the last result (process killed outright) settles nothing', () => {
    H.recordMessageCost(call('m1', { output: 100 }, { final: true }));
    H.recordTurnCost(result({ [OPUS]: { in: 2, out: 100 } }));
    H.recordMessageCost(call('m2', { output: 7 }));
    resumeQuery({ [OPUS]: { in: 2, out: 60 } });
    expect(spent()).toBeCloseTo(priceOf({ output: 100 }) + priceOf({ output: 7 }), 12);
    expect(ledger()).toBeCloseTo(spent(), 12);
    // Nothing settled m2, so a late final for it still tops it up.
    H.recordMessageCost(call('m2', { output: 30 }, { final: true }));
    expect(spent()).toBeCloseTo(priceOf({ output: 100 }) + priceOf({ output: 30 }), 12);
  });

  for (const point of ['close:after-mutate', 'close:after-ledger']) {
    it(`closing failing at ${point}: rolled back whole with the segment start, retried once`, () => {
      H.recordMessageCost(call('m1', { output: 7 }));
      const before = durable();
      H.setFailPoint(point);
      resumeQuery({ [OPUS]: { in: 2, out: 1_000 } });
      expect(durable()).toBe(before);
      H.setFailPoint(undefined);
      H.flushPendingCostEvents();
      expect(spent()).toBeCloseTo(priceOf({ output: 1_000 }), 12);
      expect(ledger()).toBeCloseTo(spent(), 12);
    });
  }

  it('an immortal group keeps at most a bounded queue; settlements are never the ones dropped', () => {
    H.setState({ costImmortal: true });
    H.setFailPoint('msg:after-spend');
    for (let i = 0; i < 10_005; i++) H.recordMessageCost(call(`m${i}`, { output: 1 }, { final: true }));
    expect(H.pendingCostEventCount()).toBe(10_000);
    H.setFailPoint(undefined);
    H.flushPendingCostEvents();
    expect(H.pendingCostEventCount()).toBe(0);
  });

  it('a negative correction for a call charged on a closed day does not refund today (R3-8)', () => {
    H.setState({ costImmortal: true, costWindow: 'daily', costDayKey: '2026-10-13' });
    setSystemTime(new Date('2026-10-13T23:59:00Z'));
    H.recordMessageCost(call('m1', { output: 1_000 }, { model: undefined })); // priced as configured Opus
    setSystemTime(new Date('2026-10-14T00:01:00Z'));
    H.recordMessageCost(call('m2', { output: 10 }, { final: true }));
    const todayBefore = spent();
    H.recordMessageCost(call('m1', { output: 1_000 }, { model: HAIKU, final: true })); // cheaper: negative
    expect(spent()).toBeCloseTo(todayBefore, 12);
    const today = sumWindow(getOutboundDb(), RATE_TABLE, '2026-10-14', '2026-10-15', H.getState().ledgerGen).usd;
    expect(today).toBeCloseTo(spent(), 12);
    expect(message('m1')?.model).toBe(HAIKU);
    setSystemTime();
  });

  it('…also when nothing has rolled the window into the new day yet', () => {
    H.setState({ costImmortal: true, costWindow: 'daily', costDayKey: '2026-10-13' });
    setSystemTime(new Date('2026-10-13T23:59:00Z'));
    H.recordMessageCost(call('m1', { output: 1_000 }, { model: undefined }));
    setSystemTime(new Date('2026-10-14T00:01:00Z'));
    H.recordMessageCost(call('m1', { output: 1_000 }, { model: HAIKU, final: true }));
    expect(H.getState().costDayKey).toBe('2026-10-14');
    expect(spent()).toBe(0);
    const today = sumWindow(getOutboundDb(), RATE_TABLE, '2026-10-14', '2026-10-15', H.getState().ledgerGen).usd;
    expect(today).toBeCloseTo(0, 12);
    setSystemTime();
  });

  it("a late call claiming yesterday's residual at a cheaper TTL does not refund today either", () => {
    H.setState({ costImmortal: true, costWindow: 'daily', costDayKey: '2026-10-13' });
    setSystemTime(new Date('2026-10-13T23:00:00Z'));
    H.recordMessageCost(call('m1', { output: 10, cw1h: 1_000 }, { final: true })); // main thread writes 1h
    H.recordTurnCost(result({ [OPUS]: { in: 4, out: 10, cw: 21_000 } })); // 20,000 residual, guessed 1h
    setSystemTime(new Date('2026-10-14T00:01:00Z'));
    // The subagent call behind it, dated before that result: 5m writes, cheaper than the 1h guess.
    H.recordMessageCost(
      call('sub', { output: 0, cw5: 20_000 }, { isSubagent: true, final: true, callTs: '2026-10-13T22:59:00.000Z' }),
    );
    expect(H.getState().costDayKey).toBe('2026-10-14');
    expect(spent()).toBe(0);
    const today = sumWindow(getOutboundDb(), RATE_TABLE, '2026-10-14', '2026-10-15', H.getState().ledgerGen).usd;
    expect(today).toBeCloseTo(0, 12);
    setSystemTime();
  });

  it('a negative correction on the SAME day lowers it, counter and ledger alike', () => {
    H.setState({ costImmortal: true, costWindow: 'daily', costDayKey: '2026-10-14' });
    setSystemTime(new Date('2026-10-14T10:00:00Z'));
    H.recordMessageCost(call('m1', { output: 1_000 }, { model: undefined }));
    H.recordMessageCost(call('m1', { output: 1_000 }, { model: HAIKU, final: true }));
    expect(spent()).toBeCloseTo(priceOf({ output: 1_000 }, HAIKU), 12);
    const today = sumWindow(getOutboundDb(), RATE_TABLE, '2026-10-14', '2026-10-15', H.getState().ledgerGen).usd;
    expect(today).toBeCloseTo(spent(), 12);
    setSystemTime();
  });

  it('an aborted stream still charges the finals the provider queued (R3-7)', async () => {
    getInboundDb()
      .prepare(
        `INSERT INTO messages_in (id, kind, timestamp, status, content, seq) VALUES ('a1','chat',?, 'pending', ?, 2)`,
      )
      .run(new Date().toISOString(), JSON.stringify({ sender: 'admin', text: 'hi' }));
    const queued = [call('sub_q', { output: 20 }, { isSubagent: true, final: true })];
    const query: AgentQuery = {
      push() {},
      end() {},
      abort() {},
      drainPendingUsage: () => queued.splice(0),
      events: {
        async *[Symbol.asyncIterator]() {
          yield { type: 'init', continuation: SID };
          yield call('m1', { output: 100 }, { final: true });
          // the stream ends without a result (aborted for a slash command)
        },
      },
    };
    await processQuery(
      query,
      { platformId: 'dashboard:admin', channelType: 'dashboard', threadId: null, inReplyTo: undefined, taskRun: false },
      ['a1'],
      'claude',
      undefined,
      'hi',
    );
    expect(spent()).toBeCloseTo(priceOf({ output: 100 }) + priceOf({ output: 20 }), 12);
  });
});

describe('round 2 — fail closed, window stamps, model move, timestamps, daily rows, hard-stop drain', () => {
  it('accounting that cannot commit HALTS the session (never drops); it resumes when storage does (item 1)', () => {
    H.setFailPoint('msg:after-spend');
    for (let i = 0; i < 5; i++) H.recordMessageCost(call(`m${i}`, { output: 100 }, { final: true }));
    expect(H.pendingCostEventCount()).toBe(5);
    expect(H.costAccountingHalted()).toBe(true);
    expect(spent()).toBe(0);
    H.setFailPoint(undefined);
    expect(H.costAccountingHalted()).toBe(false); // the check retries
    expect(spent()).toBeCloseTo(5 * priceOf({ output: 100 }), 12);
    expect(ledger()).toBeCloseTo(spent(), 12);
  });

  it('an immortal group is never halted by its bookkeeping', () => {
    H.setState({ costImmortal: true });
    H.setFailPoint('msg:after-spend');
    H.recordMessageCost(call('m1', { output: 100 }, { final: true }));
    expect(H.costAccountingHalted()).toBe(false);
  });

  it('a /clear with events still unrecorded discards them — they never charge the new window (item 4)', () => {
    H.setFailPoint('msg:after-spend');
    H.recordMessageCost(call('m_old', { output: 1_000 }, { final: true }));
    H.resetCostForNewSession(); // still failing: deliberately dropped
    H.setFailPoint(undefined);
    expect(H.pendingCostEventCount()).toBe(0);
    freshQuery('sess-B');
    H.recordMessageCost(call('m_new', { output: 10 }, { final: true }));
    expect(spent()).toBeCloseTo(priceOf({ output: 10 }), 12);
  });

  it('a pending event from a closed UTC day is discarded, not billed to the new day (item 4)', () => {
    H.setState({ costImmortal: true, costWindow: 'daily', costDayKey: '2026-10-13' });
    setSystemTime(new Date('2026-10-13T23:59:00Z'));
    H.setFailPoint('msg:after-spend');
    H.recordMessageCost(call('m_late', { output: 1_000 }, { final: true }));
    H.setFailPoint(undefined);
    setSystemTime(new Date('2026-10-14T00:01:00Z'));
    H.recordMessageCost(call('m_today', { output: 10 }, { final: true }));
    expect(H.pendingCostEventCount()).toBe(0);
    expect(spent()).toBeCloseTo(priceOf({ output: 10 }), 12);
    setSystemTime();
  });

  it('a daily window: a final after midnight lands in the NEW day, in the counter and the ledger alike (item 9)', () => {
    H.setState({ costImmortal: true, costWindow: 'daily', costDayKey: '2026-10-13' });
    setSystemTime(new Date('2026-10-13T23:59:00Z'));
    H.recordMessageCost(call('m1', { output: 8 }));
    setSystemTime(new Date('2026-10-14T00:01:00Z'));
    H.recordMessageCost(call('m1', { output: 8_178 }, { final: true }));
    const today = sumWindow(getOutboundDb(), RATE_TABLE, '2026-10-14', '2026-10-15', H.getState().ledgerGen).usd;
    expect(spent()).toBeCloseTo(priceOf({ input: 0, output: 8_170 }), 12); // the new day holds only the top-up
    expect(today).toBeCloseTo(spent(), 12);
    setSystemTime();
  });

  it('moving a call AFTER a result re-settles the bucket its snapshot was offsetting (item 3)', () => {
    // A model-less snapshot is priced as configured Opus; the result shows an
    // Opus compaction (off-stream) and the call itself under Haiku.
    H.recordMessageCost(call('m1', { output: 5 }, { model: undefined }));
    H.recordTurnCost(result({ [OPUS]: { in: 2, out: 50 }, [HAIKU]: { in: 2, out: 300 } }));
    H.recordMessageCost(call('m1', { output: 300 }, { model: HAIKU, final: true }));
    // Owed now: the Opus compaction (2 in, 50 out) and the Haiku call — nothing twice.
    expect(spent()).toBeCloseTo(priceOf({ input: 2, output: 50 }) + priceOf({ output: 300 }, HAIKU), 12);
    expect(ledger()).toBeCloseTo(spent(), 12);
    H.recordTurnCost(result({ [OPUS]: { in: 2, out: 50 }, [HAIKU]: { in: 2, out: 300 } }));
    expect(spent()).toBeCloseTo(priceOf({ input: 2, output: 50 }) + priceOf({ output: 300 }, HAIKU), 12);
  });

  it('a non-canonical transcript timestamp before the result still consumes credit (item 8)', () => {
    setSystemTime(new Date('2026-10-14T10:00:00.000Z'));
    H.recordTurnCost(result({ [OPUS]: { in: 2, out: 124 } })); // SDK counted the call
    // 11:59:59+02:00 = 09:59:59Z — before the result, though it sorts after it as text.
    H.recordMessageCost(
      call('sub_tz', { output: 124 }, { isSubagent: true, final: true, callTs: '2026-10-14T11:59:59+02:00' }),
    );
    expect(spent()).toBeCloseTo(priceOf({ output: 124 }), 12);
    setSystemTime();
  });

  it('a hard stop keeps reading the stream for accounting only: a late subagent final is charged (item 5)', async () => {
    getInboundDb()
      .prepare(
        `INSERT INTO messages_in (id, kind, timestamp, status, content, seq) VALUES ('h1','chat',?, 'pending', ?, 2)`,
      )
      .run(new Date().toISOString(), JSON.stringify({ sender: 'admin', text: 'hi' }));
    H.setState({ costCeilingUsd: 0.0001, costCeilingAllotmentUsd: 0.0001 });
    const acc: UsageAccounting = {
      inputTokens: 0,
      outputTokens: 0,
      cacheCreationInputTokens: 0,
      cacheReadInputTokens: 0,
      ephemeral1hInputTokens: 0,
      ephemeral5mInputTokens: 0,
      durationMs: 0,
      totalCostUsd: 0,
      numTurns: 1,
      sessionId: SID,
      modelUsage: modelUsage({ [OPUS]: { in: 2, out: 100 } }),
    };
    let ended = false;
    const query: AgentQuery = {
      push() {},
      end() {
        ended = true;
      },
      abort() {},
      drainPendingUsage: () => [call('sub_q', { output: 20 }, { isSubagent: true, final: true })],
      events: {
        async *[Symbol.asyncIterator]() {
          yield { type: 'init', continuation: SID };
          yield call('m1', { output: 100 }, { final: true });
          yield { type: 'result', text: 'done', accounting: acc };
          yield { type: 'usage', ...acc };
          // Read after the hard stop, accounting only:
          yield call('sub_late', { output: 50 }, { isSubagent: true, final: true });
          yield { type: 'text', text: 'never delivered' };
        },
      },
    };
    await processQuery(
      query,
      { platformId: 'dashboard:admin', channelType: 'dashboard', threadId: null, inReplyTo: undefined, taskRun: false },
      ['h1'],
      'claude',
      undefined,
      'hi',
    );
    expect(ended).toBe(true);
    expect(spent()).toBeCloseTo(priceOf({ output: 100 }) + priceOf({ output: 20 }) + priceOf({ output: 50 }), 12);
  });
});
