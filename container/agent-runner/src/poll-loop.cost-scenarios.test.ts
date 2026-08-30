/**
 * Behavioral cost-accounting SCENARIOS for the runner's live cost cap.
 *
 * These are end-to-end-ish assertions over the REAL accrual machinery in
 * poll-loop.ts (initCostTracking / recordMessageCost / recordTurnCost /
 * foldCodexCost / resetCostForNewSession / reconcileLedger), reached through the
 * additive `__costCapTestHooks` seam. Every expectation here was VERIFIED against
 * the source before it was written — where the code disagreed with the naive
 * expectation, the test asserts the CODE's behavior and the divergence is called
 * out in a comment (see the #65-ledger baseline notes in scenario 3).
 *
 * Same conventions as the sibling suites (`poll-loop.cost.test.ts`,
 * `poll-loop.message-cost.test.ts`, `codex-cost.test.ts`):
 *   - NO module mocks — bun's `mock.module` is process-global and leaks across
 *     files. We drive the REAL in-memory session DB (initTestSessionDb) and REAL
 *     pricing (pricing.ts / codex-cost.ts).
 *   - `CODEX_HOME` is pinned to a fresh empty temp dir per test, because
 *     `codexHome()` falls back to `~/.codex` and the fold would otherwise scan the
 *     developer's real rollouts (flaky). Codex tests write rollouts INTO it.
 *   - getConfig() is set via the additive `__setConfigForTest` seam and restored
 *     to its pristine null in teardown, so nothing leaks to sibling files.
 *
 * Coverage map (from the task):
 *   1. Provider gating — claude & codex accrue; opencode & pi do NOT (known gap).
 *   2. Model switch — each message priced under the model in effect (claude here;
 *      the codex per-model case extends codex-cost.test.ts).
 *   3. Restart — spend survives, no double-count, no loss; #65 ledger rows persist
 *      and a codex re-fold writes no duplicate row.
 *   4. /clear resets the window + rotates the ledger epoch in the SAME session;
 *      /compact does neither (its summary is ordinary costed spend).
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { closeSessionDb, initTestSessionDb, getOutboundDb } from './mailbox/sqlite/connection.js';
import { getCostCap } from './db/session-state.js';
import { __setConfigForTest } from './config.js';
import { __costCapTestHooks as H } from './poll-loop.js';
import { __resetCodexCostMemo } from './codex-cost.js';
import { priceUsage } from './pricing.js';
import { categorizeMessage, isClearCommand } from './formatter.js';
import type { RunnerConfig } from './config.js';
import type { ProviderEvent } from './providers/types.js';
import type { MessageInRow } from './db/messages-in.js';

const MODEL = 'claude-opus-4-8'; // input $5/Mtok
const SONNET = 'claude-sonnet-4-6'; // input $3/Mtok — a real, differently-priced key
const D_TODAY = new Date().toISOString().slice(0, 10);

/** A minimal loaded RunnerConfig; override the cost fields per test. */
function cfg(over: Partial<RunnerConfig> = {}): RunnerConfig {
  return {
    provider: 'claude',
    assistantName: 'test',
    groupName: 'test',
    agentGroupId: 'ag-test',
    maxMessagesPerPrompt: 10,
    mcpServers: {},
    model: MODEL,
    ...over,
  };
}

/** Seed the module cost accumulator directly (bypasses initCostTracking). */
function seed(over: Parameters<typeof H.setState>[0] = {}): void {
  H.setState({
    costEnabled: true,
    costImmortal: false,
    costWindow: 'lifetime',
    costDayKey: undefined,
    costAllotmentUsd: 1000,
    costCapUsd: 1000,
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
    codexLedger: {},
    codexUsdCharged: 0,
    codexLedgerBaselinePending: false,
    ledgerGen: 0,
    ledgerAdjSeq: 0,
    ledgerBaselinePending: false,
    ledgerBaselineVersion: undefined,
    seenMessageIds: [],
    turnSawMessageUsage: false,
    turnMessageCostUsd: 0,
    turnUnpricedCount: 0,
    turnMissingIdCount: 0,
    turnNoUsageCount: 0,
    codexEventOwners: {},
    ...over,
  });
}

/** One streamed assistant `message_usage`; 1M non-cached input so pricing is the
 *  model's input rate alone (opus $5, sonnet $3). */
function mu(messageId: string | null, model: string): Extract<ProviderEvent, { type: 'message_usage' }> {
  return {
    type: 'message_usage',
    messageId,
    model,
    inputTokens: 1_000_000,
    outputTokens: 0,
    cacheCreationInputTokens: 0,
    cacheReadInputTokens: 0,
    ephemeral1hInputTokens: 0,
    ephemeral5mInputTokens: 0,
    isSubagent: false,
  };
}

/** The dollar price of one `mu(...)` message at a given model. */
const oneMsgUsd = (model: string) => priceUsage(model, { input_tokens: 1_000_000 });

// ── codex rollout writer (same on-disk shape as poll-loop.message-cost.test.ts) ──
let codexHomeDir: string;
let prevCodexHome: string | undefined;

function writeRollout(day: string, name: string, entries: Array<{ ts: string; input: number; output?: number }>): string {
  const [y, m, d] = day.split('-');
  const dir = path.join(codexHomeDir, 'sessions', y, m, d);
  fs.mkdirSync(dir, { recursive: true });
  const lines = [
    JSON.stringify({
      timestamp: `${day}T00:00:00.000Z`,
      type: 'turn_context',
      payload: { cwd: '/workspace/agent', model: 'gpt-5.6-sol' },
    }),
    ...entries.map((e) => {
      const u = {
        input_tokens: e.input,
        cached_input_tokens: 0,
        cache_write_input_tokens: 0,
        output_tokens: e.output ?? 0,
        reasoning_output_tokens: 0,
        total_tokens: e.input + (e.output ?? 0),
      };
      return JSON.stringify({
        timestamp: e.ts,
        type: 'event_msg',
        payload: { type: 'token_count', info: { total_token_usage: u, last_token_usage: u } },
      });
    }),
  ];
  const p = path.join(dir, `rollout-${day}T10-00-00-${name}.jsonl`);
  fs.writeFileSync(p, lines.join('\n'));
  return p;
}

// ── #65 durable ledger row helpers (the cost_events table on outbound.db) ──
function ledgerRowCount(): number {
  return (getOutboundDb().prepare('SELECT COUNT(*) AS n FROM cost_events').get() as { n: number }).n;
}
function ledgerRowsByGen(): Record<number, number> {
  const rows = getOutboundDb()
    .prepare('SELECT window_gen AS g, COUNT(*) AS n FROM cost_events GROUP BY window_gen')
    .all() as Array<{ g: number; n: number }>;
  const out: Record<number, number> = {};
  for (const r of rows) out[r.g] = r.n;
  return out;
}

beforeEach(() => {
  initTestSessionDb();
  prevCodexHome = process.env.CODEX_HOME;
  codexHomeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cost-scen-codex-'));
  process.env.CODEX_HOME = codexHomeDir;
  __setConfigForTest(cfg());
  __resetCodexCostMemo();
  seed();
});

afterEach(() => {
  __setConfigForTest(null); // restore pristine — nothing leaks to sibling files
  closeSessionDb();
  if (prevCodexHome === undefined) delete process.env.CODEX_HOME;
  else process.env.CODEX_HOME = prevCodexHome;
  fs.rmSync(codexHomeDir, { recursive: true, force: true });
  __resetCodexCostMemo();
  // Reset ALL poll-loop cost singletons to a clean baseline. bun:test shares one
  // process across files, and these singletons (esp. the per-turn accounting flags
  // turnSawMessageUsage / turnMessageCostUsd, seenMessageIds, ledgerGen, the codex
  // ledger) leak forward. This file sorts alphabetically BEFORE poll-loop.cost.test.ts
  // ('-' < '.'), whose seed() does not reset the turn counters — leaving
  // turnSawMessageUsage=true here would make its first recordTurnCost take the
  // "fully-accounted" fast path and charge nothing. seed() zeroes every field, so
  // the next file starts clean regardless of run order.
  seed();
});

// ───────────────────────────────────────────────────────────────────────────
// 1. Provider gating — claude & codex accrue; opencode & pi do NOT.
//    VERIFIED: initCostTracking's gate is
//      costEnabled = costAllotmentUsd > 0 && (provider === 'claude' || 'codex')
//    (poll-loop.ts). opencode/pi are a KNOWN, deliberate gap — they have no
//    accounting source, so metering them would paint a false-green $0. We PIN it.
// ───────────────────────────────────────────────────────────────────────────
describe('1. provider gating — claude & codex cost; opencode & pi do not', () => {
  it('claude: initCostTracking enables the cap and a message_usage accrues', () => {
    __setConfigForTest(cfg({ costCapT2Usd: 1000, costCeilingT2Usd: 0 }));
    H.initCostTracking('claude');
    expect(H.getState().costEnabled).toBe(true);

    H.recordMessageCost(mu('m1', MODEL));
    expect(H.getState().costSpentUsd).toBeGreaterThan(0);
    expect(H.getState().costSpentUsd).toBeCloseTo(oneMsgUsd(MODEL), 8); // $5
  });

  it('codex: enabled (#1333); baselines pre-existing history, then charges NEW calls', () => {
    __setConfigForTest(cfg({ costCapT2Usd: 1000, costCeilingT2Usd: 0 }));
    H.initCostTracking('codex');
    // The differentiator from opencode/pi: a codex-primary session with a cap is metered.
    expect(H.getState().costEnabled).toBe(true);
    // A native-codex session has run uncapped and ALREADY has rollout history, so it
    // must absorb that once (baseline) before it charges — else the deploy tick bills
    // it retroactively. VERIFIED: initCostTracking sets this for provider 'codex'.
    expect(H.getState().codexLedgerBaselinePending).toBe(true);

    // Complete the baseline on the (currently empty) rollout history: an empty scan
    // is "empty-but-complete", so the baseline finishes and future calls are charged.
    __resetCodexCostMemo();
    H.foldCodexCost();
    expect(H.getState().codexLedgerBaselinePending).toBe(false);
    expect(H.getState().costSpentUsd).toBe(0);

    // A genuinely NEW codex call after the baseline IS charged — codex DOES cost.
    writeRollout(D_TODAY, 'aaa', [{ ts: `${D_TODAY}T10:00:00.000Z`, input: 1_000_000 }]);
    __resetCodexCostMemo();
    H.foldCodexCost();
    expect(H.getState().costSpentUsd).toBeGreaterThan(0);
    expect(H.getState().costSpentUsd).toBeCloseTo(5, 6); // 1M input @ $5/Mtok
  });

  it('opencode: cap stays DISABLED — no accrual from a message OR a codex fold', () => {
    __setConfigForTest(cfg({ costCapT2Usd: 1000, costCeilingT2Usd: 0 }));
    H.initCostTracking('opencode');
    expect(H.getState().costEnabled).toBe(false);

    // Both accrual paths are inert while disabled.
    H.recordMessageCost(mu('m1', MODEL));
    writeRollout(D_TODAY, 'aaa', [{ ts: `${D_TODAY}T10:00:00.000Z`, input: 1_000_000 }]);
    __resetCodexCostMemo();
    H.foldCodexCost();

    expect(H.getState().costSpentUsd).toBe(0);
  });

  it('pi: cap stays DISABLED — same known gap', () => {
    __setConfigForTest(cfg({ costCapT2Usd: 1000, costCeilingT2Usd: 0 }));
    H.initCostTracking('pi');
    expect(H.getState().costEnabled).toBe(false);

    H.recordMessageCost(mu('m1', MODEL));
    expect(H.getState().costSpentUsd).toBe(0);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 2. Model switch — each message priced under the model in effect.
//    (Codex's rollout-model-switch case is an extension in codex-cost.test.ts —
//    'prices two known models at different rates when a rollout switches model' —
//    which reuses that suite's turnContext/tokenCount/costOf helpers.)
// ───────────────────────────────────────────────────────────────────────────
describe('2. model switch — per-model pricing, not one blanket rate', () => {
  it('claude: an opus message then a sonnet message are each charged at their own rate', () => {
    seed({ costCapUsd: 1000, costAllotmentUsd: 1000 }); // high cap, no ceiling — isolate pricing
    const opusUsd = oneMsgUsd(MODEL); // $5.00 @ opus input rate
    const sonnetUsd = oneMsgUsd(SONNET); // $3.00 @ sonnet input rate
    expect(opusUsd).not.toBeCloseTo(sonnetUsd, 6); // sanity: the two models really differ

    H.recordMessageCost(mu('m-opus', MODEL)); // priced under opus
    H.recordMessageCost(mu('m-sonnet', SONNET)); // priced under sonnet

    // Charged per the model in effect for each message — the sum of the two rates…
    expect(H.getState().costSpentUsd).toBeCloseTo(opusUsd + sonnetUsd, 8);
    // …NOT one blanket rate applied to both.
    expect(H.getState().costSpentUsd).not.toBeCloseTo(opusUsd * 2, 6);
    expect(H.getState().costSpentUsd).not.toBeCloseTo(sonnetUsd * 2, 6);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 3. Restart — cost survives, no double-count, no loss.
//    VERIFIED: state is persisted to outbound.db `cost_cap`; a respawned container
//    re-hydrates via initCostTracking (adopting persisted spend, cap, ledgerGen,
//    codexLedger). Codex accrual is DELTA-based against the persisted per-(file,day)
//    watermark, so a re-fold after restart charges nothing. #65 ledger rows live in
//    the cost_events table and are keyed by an identity PK (INSERT OR IGNORE), so a
//    re-fold cannot duplicate a row.
// ───────────────────────────────────────────────────────────────────────────
describe('3. restart — spend resumes, is not doubled, is not lost', () => {
  it('re-init from the persisted blob resumes at the persisted value; a re-fold does not re-charge', () => {
    __setConfigForTest(cfg({ costCapT2Usd: 1000, costCeilingT2Usd: 0 })); // ceiling off → never stops
    H.initCostTracking('claude'); // fresh: creates cost_events, migration-baselines ledgerGen 0→1
    expect(H.getState().costEnabled).toBe(true);

    // Claude spend ($5) + a codex MCP call ($5). A Claude session owes no codex
    // baseline, so the fold charges the rollout immediately.
    H.recordMessageCost(mu('m1', MODEL));
    writeRollout(D_TODAY, 'aaa', [{ ts: `${D_TODAY}T10:00:00.000Z`, input: 1_000_000 }]);
    __resetCodexCostMemo();
    H.foldCodexCost();
    const beforeRestart = H.getState().costSpentUsd;
    expect(beforeRestart).toBeCloseTo(10, 6);

    // The persisted blob is exactly what a respawn re-hydrates from (and what the host reads).
    expect(getCostCap()?.spentUsd).toBeCloseTo(10, 6);
    const rowsBefore = ledgerRowCount();
    expect(rowsBefore).toBeGreaterThan(0); // #65 ledger rows are durable in the DB, not the counter

    // ── RESTART: zero the in-memory singletons (a cold process), then re-init from
    // the SAME outbound.db. This is how container-runner respawns a session.
    H.setState({
      costEnabled: false,
      costSpentUsd: 0,
      costCapUsd: 0,
      codexLedger: {},
      codexUsdCharged: 0,
      seenMessageIds: [],
      ledgerGen: 0,
      ledgerAdjSeq: 0,
      ledgerBaselineVersion: undefined,
      costBudgetGen: 0,
      codexEventOwners: {},
    });
    H.initCostTracking('claude');
    expect(H.getState().costSpentUsd).toBeCloseTo(10, 6); // resumes at persisted — NOT 0, NOT doubled
    expect(ledgerRowCount()).toBe(rowsBefore); // re-init adds no rows; the ledger is intact

    // A further charge adds on TOP of the restored spend.
    H.recordMessageCost(mu('m2', MODEL));
    expect(H.getState().costSpentUsd).toBeCloseTo(15, 6);
    const rowsAfterCharge = ledgerRowCount();

    // Re-running the codex fold after restart does NOT re-charge already-watermarked spend…
    __resetCodexCostMemo();
    H.foldCodexCost();
    expect(H.getState().costSpentUsd).toBeCloseTo(15, 6); // unchanged — delta-based watermark restored
    // …and writes NO duplicate #65 ledger row (identity PK → INSERT OR IGNORE).
    expect(ledgerRowCount()).toBe(rowsAfterCharge);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 4. /clear and /compact.
//    VERIFIED (poll-loop.ts + formatter.ts):
//      - /clear → isClearCommand → resetCostForNewSession: zeroes the LIFETIME
//        window, rotates costBudgetGen AND ledgerGen (a new budget epoch), same
//        session (no new session id, same outbound.db). Prior-gen ledger rows stay;
//        the reconcile is per-gen.
//      - /compact is an ADMIN command (formatter ADMIN_COMMANDS), NOT a clear
//        (isClearCommand matches only '/clear'). It is re-dispatched to the SDK and
//        NEVER calls resetCostForNewSession — no epoch change. The compaction's
//        summary is costed as an ordinary message_usage.
// ───────────────────────────────────────────────────────────────────────────
describe('4a. /clear — window reset + ledger-epoch rotation, in the SAME session', () => {
  it('zeroes spend, increments ledgerGen; prior-gen rows persist and reconcile is per-gen', () => {
    __setConfigForTest(cfg({ costCapT2Usd: 1000, costCeilingT2Usd: 0 }));
    const sidBefore = process.env.NANOCLAW_SESSION_ID; // session identity is never touched by /clear
    H.initCostTracking('claude');

    // Spend in the first (pre-clear) window.
    H.recordMessageCost(mu('pre1', MODEL));
    const genBefore = H.getState().ledgerGen;
    const budgetGenBefore = H.getState().costBudgetGen;
    expect(H.getState().costSpentUsd).toBeCloseTo(oneMsgUsd(MODEL), 8);
    expect(ledgerRowsByGen()[genBefore]).toBeGreaterThanOrEqual(1);

    // ── /clear ──
    H.resetCostForNewSession();

    // Counter reset to $0; a NEW budget epoch on both fences; SAME session (id unchanged).
    expect(H.getState().costSpentUsd).toBe(0);
    expect(H.getState().ledgerGen).toBe(genBefore + 1); // new ledger epoch
    expect(H.getState().costBudgetGen).toBe(budgetGenBefore + 1); // new grant epoch
    expect(process.env.NANOCLAW_SESSION_ID).toBe(sidBefore); // NOT a new nanoclaw session
    const genAfter = H.getState().ledgerGen;

    // A post-clear charge accrues in the NEW window.
    H.recordMessageCost(mu('post1', MODEL));
    expect(H.getState().costSpentUsd).toBeCloseTo(oneMsgUsd(MODEL), 8);

    // Prior-window ledger rows STILL EXIST, tagged with the OLD gen — proof this is
    // the same session's DB (a fresh session would have an empty cost_events table).
    const byGen = ledgerRowsByGen();
    expect(byGen[genBefore]).toBeGreaterThanOrEqual(1); // old epoch's rows persist
    expect(byGen[genAfter]).toBeGreaterThanOrEqual(1); // new epoch's rows written alongside

    // The reconcile is per-gen: it sums ONLY the active epoch, so counter == ledger ==
    // the post-clear spend, and the $5 pre-clear row is excluded (not double-counted).
    const rec = H.reconcileLedger();
    expect(rec?.counterUsd).toBeCloseTo(oneMsgUsd(MODEL), 6);
    expect(rec?.ledgerUsd).toBeCloseTo(oneMsgUsd(MODEL), 6);
  });
});

describe('4b. /compact — no epoch change; the summary is ordinary costed spend', () => {
  it('is an ADMIN command, NOT a /clear — it never routes to resetCostForNewSession', () => {
    // Source-level proof of the routing: /compact categorizes as 'admin' and
    // isClearCommand (the ONLY thing that triggers resetCostForNewSession besides a
    // new_session task batch) matches only text starting with '/clear'.
    const compact = { kind: 'chat', channel_type: null, content: JSON.stringify({ text: '/compact' }) } as unknown as MessageInRow;
    const clear = { kind: 'chat', channel_type: null, content: JSON.stringify({ text: '/clear' }) } as unknown as MessageInRow;
    expect(categorizeMessage(compact).category).toBe('admin');
    expect(categorizeMessage(compact).command).toBe('/compact');
    expect(isClearCommand(compact)).toBe(false); // NOT a clear
    expect(isClearCommand(clear)).toBe(true); // control
  });

  it('a compaction-summary message is costed like any other; gen/counter are NOT reset', () => {
    __setConfigForTest(cfg({ costCapT2Usd: 1000, costCeilingT2Usd: 0 }));
    H.initCostTracking('claude');
    H.recordMessageCost(mu('turn1', MODEL)); // ordinary turn spend
    const spentBefore = H.getState().costSpentUsd;
    const genBefore = H.getState().ledgerGen;
    const budgetGenBefore = H.getState().costBudgetGen;
    const seenBefore = H.getState().seenMessageIdCount;

    // The SDK performs the compaction internally; the runner only ever sees the
    // resulting assistant message_usage. It is costed exactly as an ordinary
    // message — there is NO resetCostForNewSession, NO gen rotation.
    H.recordMessageCost(mu('compaction-summary', MODEL));

    const s = H.getState();
    expect(s.costSpentUsd).toBeCloseTo(spentBefore + oneMsgUsd(MODEL), 8); // accrues on top (NOT reset)
    expect(s.ledgerGen).toBe(genBefore); // ledger epoch UNCHANGED
    expect(s.costBudgetGen).toBe(budgetGenBefore); // grant epoch UNCHANGED
    expect(s.seenMessageIdCount).toBe(seenBefore + 1); // just another counted message
  });
});
