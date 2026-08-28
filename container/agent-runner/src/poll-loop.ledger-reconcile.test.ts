/**
 * #65 durable cost ledger — DUAL-RUN reconciliation, END TO END (findings 1 & 2).
 *
 * These drive the REAL poll-loop accrual path (recordMessageCost / recordTurnCost
 * / foldCodexCost / resetCostForNewSession / initCostTracking) against a real
 * in-memory session DB, then call the REAL `reconcileLedger()` and assert its
 * delta ≈ 0. They pin the WIRING the unit tests in cost-events.test.ts prove at
 * the primitive level: that the ledger row written on each accrual path lands in
 * the current generation and reproduces the live counter.
 *
 * Same convention as poll-loop.message-cost.test.ts: no module mocks, a real
 * in-memory session DB, real pricing. The cost_events table is NOT created by
 * initTestSessionDb, so tests that don't go through initCostTracking create it
 * explicitly.
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { closeSessionDb, initTestSessionDb, getOutboundDb } from './mailbox/sqlite/connection.js';
import { setCostCap } from './db/session-state.js';
import { __setConfigForTest } from './config.js';
import { __costCapTestHooks as H } from './poll-loop.js';
import { __resetCodexCostMemo } from './codex-cost.js';
import { createCostEventsTable } from './cost-events.js';
import { priceUsage } from './pricing.js';
import type { RunnerConfig } from './config.js';
import type { ProviderEvent } from './providers/types.js';

const MODEL = 'claude-opus-4-8';
const D_TODAY = new Date().toISOString().slice(0, 10);

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

/** Reset the whole cost machine to a clean, enabled, lifetime session — ledger state included. */
function seed(over: Parameters<typeof H.setState>[0] = {}): void {
  H.setState({
    costEnabled: true,
    costImmortal: false,
    costWindow: 'lifetime',
    costDayKey: undefined,
    costAllotmentUsd: 100000,
    costCapUsd: 100000,
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

const RESPONSE_TOKENS = {
  inputTokens: 2,
  outputTokens: 700,
  cacheCreationInputTokens: 55_000,
  cacheReadInputTokens: 60_000,
  ephemeral1hInputTokens: 0,
  ephemeral5mInputTokens: 0,
};
const ONE_RESPONSE_USD = priceUsage(MODEL, {
  input_tokens: RESPONSE_TOKENS.inputTokens,
  output_tokens: RESPONSE_TOKENS.outputTokens,
  cache_creation_input_tokens: RESPONSE_TOKENS.cacheCreationInputTokens,
  cache_read_input_tokens: RESPONSE_TOKENS.cacheReadInputTokens,
});

function messageUsage(
  messageId: string | null,
  over: Partial<Extract<ProviderEvent, { type: 'message_usage' }>> = {},
): Extract<ProviderEvent, { type: 'message_usage' }> {
  return { type: 'message_usage', messageId, model: MODEL, ...RESPONSE_TOKENS, isSubagent: false, ...over };
}

function usage(totalCostUsd: number): Extract<ProviderEvent, { type: 'usage' }> {
  return {
    type: 'usage',
    inputTokens: 0,
    outputTokens: 0,
    cacheCreationInputTokens: 0,
    cacheReadInputTokens: 0,
    ephemeral1hInputTokens: 0,
    ephemeral5mInputTokens: 0,
    durationMs: 0,
    totalCostUsd,
    numTurns: 1,
    sessionId: null,
  };
}

/** The live reconcile — asserts ledger$ == counter$ for the ACTIVE generation. */
function expectReconciled(digits = 6): void {
  const r = H.reconcileLedger();
  expect(r).toBeDefined();
  expect(r!.delta).toBeCloseTo(0, digits);
  // And explicitly: ledger reproduces the counter, not merely a small delta.
  expect(r!.ledgerUsd).toBeCloseTo(r!.counterUsd, digits);
}

let home: string;
let prevHome: string | undefined;

beforeEach(() => {
  initTestSessionDb();
  __setConfigForTest(cfg());
  __resetCodexCostMemo();
  // A fresh, empty CODEX_HOME so foldCodexCost scans cleanly (empty-but-complete)
  // for the non-codex tests; the codex describe writes rollouts into it.
  prevHome = process.env.CODEX_HOME;
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'ledger-reconcile-'));
  process.env.CODEX_HOME = home;
  createCostEventsTable(getOutboundDb());
  seed();
});

afterEach(() => {
  __setConfigForTest(null);
  closeSessionDb();
  __resetCodexCostMemo();
  if (prevHome === undefined) delete process.env.CODEX_HOME;
  else process.env.CODEX_HOME = prevHome;
  fs.rmSync(home, { recursive: true, force: true });
});

describe('#65 finding 2 — the counter fallback residual gets a ledger row', () => {
  it('a fully-accounted turn reconciles with NO adjustment (baseline sanity)', () => {
    H.recordMessageCost(messageUsage('m1'));
    H.recordTurnCost(usage(ONE_RESPONSE_USD * 3)); // inflated aggregate, case 2 → not re-charged
    expect(H.getState().costSpentUsd).toBeCloseTo(ONE_RESPONSE_USD, 8);
    expectReconciled();
  });

  it('a DEGRADED turn (null-id residual) reconciles — the residual is captured', () => {
    // m1 priced per-message; a null-id message forces the degraded fallback, which
    // charges a dollar residual with no token row behind it. Pre-fix the ledger
    // stayed at $ONE while the counter jumped to the inflated total — a phantom
    // ledger<counter delta. Now the residual is mirrored as an adjustment row.
    H.recordMessageCost(messageUsage('m1'));
    H.recordMessageCost(messageUsage(null)); // undedupable → degraded turn
    H.recordTurnCost(usage(ONE_RESPONSE_USD * 3));
    expect(H.getState().costSpentUsd).toBeCloseTo(ONE_RESPONSE_USD * 3, 8); // per-message + residual
    expectReconciled();
  });

  it('an aggregate-ONLY turn (case 1, no per-message usage) reconciles', () => {
    // A provider that reports only an end-of-turn total: the whole charge is a
    // non-token-derivable dollar. It must land in the ledger as an adjustment.
    H.recordTurnCost(usage(7));
    expect(H.getState().costSpentUsd).toBeCloseTo(7, 8);
    expectReconciled();
  });

  it('a degraded turn with a zero/low total (no positive residual) still reconciles', () => {
    // max(totalCostUsd, aggregate) - messageCost ≤ 0 → no residual charged and NO
    // adjustment row written; the per-message row alone reconciles.
    H.recordMessageCost(messageUsage('m1'));
    H.recordMessageCost(messageUsage(null));
    H.recordTurnCost(usage(0)); // aggregate tokens are 0 too → residual ≤ 0
    expect(H.getState().costSpentUsd).toBeCloseTo(ONE_RESPONSE_USD, 8);
    expectReconciled();
  });
});

describe('#65 finding 1 — window generation isolates the reconcile', () => {
  it('a /clear rotates the gen: ledger==counter==0, then a fresh charge reconciles', () => {
    // Charge a turn, reconcile. Then /clear resets the counter to $0 and rotates
    // the ledger gen; the new gen is empty so reconcile reads 0 == 0 (the old
    // gen's row is NOT summed). A fresh charge lands in the new gen and reconciles.
    H.recordMessageCost(messageUsage('m1'));
    H.recordTurnCost(usage(ONE_RESPONSE_USD * 3));
    expectReconciled();
    const genBefore = H.getState().ledgerGen;

    H.resetCostForNewSession(); // rotates ledgerGen, folds an empty codex baseline
    expect(H.getState().ledgerGen).toBe(genBefore + 1);
    expect(H.getState().costSpentUsd).toBe(0);
    expectReconciled(); // ledger 0 == counter 0 in the fresh gen

    // A fresh charge in the NEW gen reconciles. NB: a new conversation after a
    // /clear carries NEW wire message ids (Anthropic ids are globally unique), so
    // this uses a distinct id — the ledger keys claude rows by wire id, which is
    // durable across the gen boundary by design (see the boundary note in the
    // task report: a hypothetical reused id would dedup and under-count the row).
    H.recordMessageCost(messageUsage('m2'));
    expect(H.getState().costSpentUsd).toBeCloseTo(ONE_RESPONSE_USD, 8);
    expectReconciled();
  });

  it('an existing-session MIGRATION seeds the ledger to the persisted counter', () => {
    // Existing session: persisted spend $12, ledger table empty (new on this
    // branch). initCostTracking seeds one baseline adjustment = $12 at the current
    // gen so reconcile reads ledger == counter instead of $0 vs $12 forever.
    setCostCap({
      capUsd: 50,
      spentUsd: 12,
      status: 'ok',
      immortal: false,
      window: 'lifetime',
      ceilingUsd: 100,
      accountingVersion: 2,
      codexLedger: { 'a.jsonl 2026-08-18': 4 },
      codexUsd: 4,
      codexBaselinePending: false,
    });
    __setConfigForTest(cfg({ costCapT2Usd: 50, costCeilingT2Usd: 100 } as Partial<RunnerConfig>));
    H.initCostTracking('claude');
    expect(H.getState().costSpentUsd).toBeCloseTo(12, 8);
    expect(H.getState().ledgerBaselinePending).toBe(true); // first fold will sentinel pre-existing codex history
    expectReconciled();
  });

  it('MIGRATION does not double-seed on a warm respawn (rows already present)', () => {
    // First activation seeds the $9 baseline. A warm respawn re-runs
    // initCostTracking; the current gen already has a row, so it must NOT seed a
    // second $9 — reconcile would otherwise read $18 vs $9.
    const persisted = {
      capUsd: 50,
      spentUsd: 9,
      status: 'ok' as const,
      immortal: false,
      window: 'lifetime' as const,
      ceilingUsd: 100,
      accountingVersion: 2,
      codexLedger: {},
      codexBaselinePending: false,
    };
    setCostCap(persisted);
    __setConfigForTest(cfg({ costCapT2Usd: 50, costCeilingT2Usd: 100 } as Partial<RunnerConfig>));
    H.initCostTracking('claude');
    expectReconciled();
    const rowsAfterFirst = (getOutboundDb().prepare('SELECT COUNT(*) c FROM cost_events').get() as { c: number }).c;

    // Warm respawn: same persisted spend, ledger already has the seed row.
    H.initCostTracking('claude');
    const rowsAfterSecond = (getOutboundDb().prepare('SELECT COUNT(*) c FROM cost_events').get() as { c: number }).c;
    expect(rowsAfterSecond).toBe(rowsAfterFirst); // no second seed
    expect(H.getState().costSpentUsd).toBeCloseTo(9, 8);
    expectReconciled();
  });
});

describe('#65 finding 1 — codex baseline does not manufacture a phantom ledger>counter', () => {
  function writeRollout(day: string, name: string, entries: Array<{ ts: string; input: number; output?: number }>): string {
    const [y, m, d] = day.split('-');
    const dir = path.join(home, 'sessions', y, m, d);
    fs.mkdirSync(dir, { recursive: true });
    const lines = [
      JSON.stringify({ timestamp: `${day}T00:00:00.000Z`, type: 'turn_context', payload: { cwd: '/workspace/agent', model: 'gpt-5.6-sol' } }),
      ...entries.map((e) => {
        const u = {
          input_tokens: e.input,
          cached_input_tokens: 0,
          cache_write_input_tokens: 0,
          output_tokens: e.output ?? 0,
          reasoning_output_tokens: 0,
          total_tokens: e.input + (e.output ?? 0),
        };
        return JSON.stringify({ timestamp: e.ts, type: 'event_msg', payload: { type: 'token_count', info: { total_token_usage: u, last_token_usage: u } } });
      }),
    ];
    const p = path.join(dir, `rollout-${day}T10-00-00-${name}.jsonl`);
    fs.writeFileSync(p, lines.join('\n'));
    return p;
  }

  it('reconciles DURING baseline (absorbed history excluded) AND after the first real charge', () => {
    // Pre-existing rollout history: the counter absorbs it WITHOUT charging, but
    // recordCodexLedger still durably records every call. Stamped at the sentinel
    // gen, those rows must NOT inflate the current-gen reconcile.
    writeRollout(D_TODAY, 'hist', [{ ts: `${D_TODAY}T10:00:00.000Z`, input: 4_000_000 }]);
    seed({ codexLedgerBaselinePending: true });
    H.foldCodexCost();
    expect(H.getState().costSpentUsd).toBe(0); // absorbed, not charged
    expect(H.getState().codexLedgerBaselinePending).toBe(false);
    expectReconciled(); // ledger 0 == counter 0 — no phantom > counter

    // A genuinely-new call AFTER the baseline is charged AND lands in the reconciled
    // gen — even though this fold's recordCodexLedger re-sees the baselined call
    // (INSERT OR IGNORE keeps it sentinel'd via first-write-wins).
    writeRollout(D_TODAY, 'fresh', [{ ts: `${D_TODAY}T12:00:00.000Z`, input: 1_000_000 }]);
    __resetCodexCostMemo();
    H.foldCodexCost();
    expect(H.getState().costSpentUsd).toBeCloseTo(5, 6); // 1M @ $5/M
    expectReconciled();
  });

  it('a /clear re-baseline (with rollout files present) reconciles at 0, then charges the next call', () => {
    // resetCostForNewSession folds synchronously; the $5 already on disk is
    // baselined (sentinel gen), the counter is $0, and the fresh gen reconciles.
    writeRollout(D_TODAY, 'aaa', [{ ts: `${D_TODAY}T10:00:00.000Z`, input: 1_000_000 }]);
    H.resetCostForNewSession();
    expect(H.getState().costSpentUsd).toBe(0);
    expectReconciled();

    // A genuinely-new codex call after the reset is charged and reconciles.
    fs.appendFileSync(
      path.join(home, 'sessions', ...D_TODAY.split('-'), `rollout-${D_TODAY}T10-00-00-aaa.jsonl`),
      '\n' +
        JSON.stringify({
          timestamp: `${D_TODAY}T11:00:00.000Z`,
          type: 'event_msg',
          payload: {
            type: 'token_count',
            info: {
              total_token_usage: { input_tokens: 3_000_000, cached_input_tokens: 0, output_tokens: 0 },
              last_token_usage: { input_tokens: 2_000_000, cached_input_tokens: 0, output_tokens: 0 },
            },
          },
        }),
    );
    __resetCodexCostMemo();
    H.foldCodexCost();
    expect(H.getState().costSpentUsd).toBeCloseTo(10, 6); // 2M @ $5/M
    expectReconciled();
  });

  it('a plain codex charge (no baseline owed) reconciles', () => {
    writeRollout(D_TODAY, 'aaa', [{ ts: `${D_TODAY}T10:00:00.000Z`, input: 1_000_000 }]);
    H.foldCodexCost();
    expect(H.getState().costSpentUsd).toBeCloseTo(5, 6);
    expectReconciled();
  });
});
