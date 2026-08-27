/**
 * Per-message cost accounting + codex fold (issue #1327).
 *
 * THE BUG THIS PINS. The provider stream emits one assistant message per CONTENT
 * BLOCK — thinking, text and tool_use each arrive as their own `assistant`
 * message — and every block of one API response repeats the SAME wire
 * `message.id` and the SAME message-level `usage`. The runner used to accrue the
 * provider's end-of-turn aggregate once per `query()` call, which tracks the
 * NON-deduplicated magnitude of that stream. Measured on real prod transcripts
 * the non-deduped sum ran 1.7x–2.8x the deduped one; on the session that
 * motivated the issue the live counter read $166.00 against a true $78.69, so
 * its Tier-2 ceiling hard-stopped it at less than half the spend it was
 * configured for.
 *
 * `recordMessageCost` charges per assistant message, deduplicated by
 * `message.id` — the same unit `dashboard/server.ts` `scanFileCost` computes, and
 * the one that reconciles with ccusage. The first describe block below replays
 * the exact prod shape (3 blocks per response, 5 sequential resumes) and fails
 * if the duplicates are ever charged again.
 *
 * Same convention as `poll-loop.cost.test.ts`: no module mocks (bun's
 * `mock.module` is process-global and leaks across files), a real in-memory
 * session DB, real pricing.
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { closeSessionDb, initTestSessionDb } from './mailbox/sqlite/connection.js';
import { getUndeliveredMessages } from './db/messages-out.js';
import { getCostCap, setCostCap } from './db/session-state.js';
import { __setConfigForTest } from './config.js';
import { __costCapTestHooks as H } from './poll-loop.js';
import { __resetCodexCostMemo } from './codex-cost.js';
import { priceUsage } from './pricing.js';
import type { RunnerConfig } from './config.js';
import type { ProviderEvent } from './providers/types.js';

const MODEL = 'claude-opus-4-8';

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
    seenMessageIds: [],
    turnSawMessageUsage: false,
    turnMessageCostUsd: 0,
    turnUnpricedCount: 0,
    turnMissingIdCount: 0,
    ...over,
  });
}

/** The usage every block of one API response repeats verbatim. */
const RESPONSE_TOKENS = {
  inputTokens: 2,
  outputTokens: 700,
  cacheCreationInputTokens: 55_000,
  cacheReadInputTokens: 60_000,
  ephemeral1hInputTokens: 0,
  ephemeral5mInputTokens: 0,
};

/** Cost of ONE such API response, priced exactly as the dashboard prices it. */
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
  return {
    type: 'message_usage',
    messageId,
    model: MODEL,
    ...RESPONSE_TOKENS,
    isSubagent: false,
    ...over,
  };
}

/** An aggregate `usage` event; all-zero tokens so `totalCostUsd` is the only signal. */
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

function escalations(reason?: 'cap' | 'ceiling') {
  return getUndeliveredMessages().filter((m) => {
    if (m.kind !== 'system') return false;
    let c: { action?: string; reason?: string };
    try {
      c = JSON.parse(m.content) as { action?: string; reason?: string };
    } catch {
      return false;
    }
    return c.action === 'cost_escalation' && (reason ? c.reason === reason : true);
  });
}

beforeEach(() => {
  initTestSessionDb();
  __setConfigForTest(cfg());
  __resetCodexCostMemo();
  seed();
});

afterEach(() => {
  __setConfigForTest(null);
  closeSessionDb();
  __resetCodexCostMemo();
});

describe('#1327 regression — a multi-resume session is NOT double-counted', () => {
  it('charges one API response ONCE even though it arrives as 3 blocks, across 5 resumes', () => {
    // Exactly the prod shape: 5 sequential query() calls (one per resume), each
    // producing 2 API responses, each response streamed as 3 assistant messages
    // (thinking / text / tool_use) that repeat one id and one usage. The turn's
    // aggregate event reports the block-inflated 3x figure — the old basis.
    const RESUMES = 5;
    const RESPONSES_PER_TURN = 2;
    const BLOCKS = 3;

    for (let resume = 0; resume < RESUMES; resume++) {
      for (let r = 0; r < RESPONSES_PER_TURN; r++) {
        const id = `msg_resume${resume}_resp${r}`;
        for (let b = 0; b < BLOCKS; b++) H.recordMessageCost(messageUsage(id));
      }
      // What the SDK aggregate would have claimed for this turn.
      H.recordTurnCost(usage(ONE_RESPONSE_USD * RESPONSES_PER_TURN * BLOCKS));
    }

    const expected = ONE_RESPONSE_USD * RESPONSES_PER_TURN * RESUMES;
    expect(H.getState().costSpentUsd).toBeCloseTo(expected, 8);
    // And explicitly: NOT the 3x figure the old basis produced.
    expect(H.getState().costSpentUsd).not.toBeCloseTo(expected * BLOCKS, 4);
    expect(H.getState().seenMessageIdCount).toBe(RESUMES * RESPONSES_PER_TURN);
  });

  it('reproduces the measured 2.1x: the old basis crosses a ceiling the new one does not', () => {
    // A $100 ceiling with ~2.1x of real spend below it. Under the old basis the
    // session hard-stops; under per-message accounting it keeps running, which is
    // the user-visible half of the bug.
    const ceiling = ONE_RESPONSE_USD * 25;
    seed({ costCapUsd: ceiling, costAllotmentUsd: ceiling, costCeilingUsd: ceiling });

    for (let i = 0; i < 12; i++) {
      const id = `msg_${i}`;
      for (let b = 0; b < 3; b++) H.recordMessageCost(messageUsage(id));
    }
    H.recordTurnCost(usage(ONE_RESPONSE_USD * 36));

    expect(H.getState().costSpentUsd).toBeCloseTo(ONE_RESPONSE_USD * 12, 8);
    expect(H.getState().costCeilingHardStop).toBe(false);
    expect(H.computeCostStatus()).toBe('ok');
    // The old basis would have charged 36 responses — comfortably over.
    expect(ONE_RESPONSE_USD * 36).toBeGreaterThan(ceiling);
  });

  it('still charges DISTINCT ids — dedup must not swallow real spend', () => {
    for (let i = 0; i < 4; i++) H.recordMessageCost(messageUsage(`msg_${i}`));
    expect(H.getState().costSpentUsd).toBeCloseTo(ONE_RESPONSE_USD * 4, 8);
  });

  it('prices by the message model, not the configured one', () => {
    seed();
    H.recordMessageCost(messageUsage('m1', { model: 'claude-haiku-4-5' }));
    const haiku = priceUsage('claude-haiku-4-5', {
      input_tokens: RESPONSE_TOKENS.inputTokens,
      output_tokens: RESPONSE_TOKENS.outputTokens,
      cache_creation_input_tokens: RESPONSE_TOKENS.cacheCreationInputTokens,
      cache_read_input_tokens: RESPONSE_TOKENS.cacheReadInputTokens,
    });
    expect(haiku).toBeLessThan(ONE_RESPONSE_USD); // sanity: the models differ
    expect(H.getState().costSpentUsd).toBeCloseTo(haiku, 8);
  });

  it('charges subagent messages once (distinct ids, no double count against the parent)', () => {
    H.recordMessageCost(messageUsage('parent_1'));
    H.recordMessageCost(messageUsage('sub_1', { isSubagent: true }));
    H.recordMessageCost(messageUsage('sub_1', { isSubagent: true })); // its second block
    H.recordTurnCost(usage(ONE_RESPONSE_USD * 3));
    expect(H.getState().costSpentUsd).toBeCloseTo(ONE_RESPONSE_USD * 2, 8);
  });

  it('INCLUDES Task-tool subagent spend rather than stranding it', () => {
    // The structural trap this guards: a Claude Task-tool subagent writes its
    // transcript to a SEPARATE file under `<parent-sdk-session-id>/subagents/`,
    // which nothing routes back to the nanoclaw session — an on-disk scanner
    // keyed by file basename attributes 100% of it to an orphan bucket. The
    // runner sidesteps that entirely by charging off the STREAM (the provider
    // forwards subagent messages with `parent_tool_use_id` set), so the spend
    // lands on the session that actually made it. If subagent messages ever stop
    // reaching the accumulator, this goes red.
    const parentOnly = ONE_RESPONSE_USD * 2;
    H.recordMessageCost(messageUsage('parent_1'));
    H.recordMessageCost(messageUsage('parent_2'));
    for (const id of ['sub_a', 'sub_b', 'sub_c']) {
      H.recordMessageCost(messageUsage(id, { isSubagent: true }));
    }
    const total = H.getState().costSpentUsd;
    expect(total).toBeCloseTo(ONE_RESPONSE_USD * 5, 8);
    expect(total).toBeGreaterThan(parentOnly); // the subagent half is not silently dropped
  });

  it('a subagent that pushes the session over the ceiling still stops it', () => {
    seed({ costCeilingUsd: ONE_RESPONSE_USD * 1.5, costCapUsd: 1000, costAllotmentUsd: 1000 });
    H.recordMessageCost(messageUsage('parent_1'));
    expect(H.getState().costStopRequested).toBe(false);
    H.recordMessageCost(messageUsage('sub_1', { isSubagent: true }));
    expect(H.getState().costStopRequested).toBe(true);
  });

  it('crosses the ceiling from a message event, so a runaway turn is caught at its end', () => {
    seed({ costCeilingUsd: ONE_RESPONSE_USD * 1.5, costCapUsd: 1000, costAllotmentUsd: 1000 });
    H.recordMessageCost(messageUsage('m1'));
    expect(H.getState().costCeilingHardStop).toBe(false);
    H.recordMessageCost(messageUsage('m2'));
    expect(H.getState().costCeilingHardStop).toBe(true);
    expect(H.getState().costStopRequested).toBe(true);
    expect(escalations('ceiling')).toHaveLength(1);
  });
});

describe('#1327 — completeness gating of the aggregate fallback', () => {
  it('falls back to the aggregate when the provider emits NO per-message usage', () => {
    // A provider that only reports an end-of-turn total keeps working exactly as
    // it did before the change.
    H.recordTurnCost(usage(7));
    expect(H.getState().costSpentUsd).toBeCloseTo(7, 8);
  });

  it('does NOT re-charge the aggregate when every message was priced', () => {
    H.recordMessageCost(messageUsage('m1'));
    H.recordTurnCost(usage(ONE_RESPONSE_USD * 3)); // the inflated aggregate
    expect(H.getState().costSpentUsd).toBeCloseTo(ONE_RESPONSE_USD, 8);
  });

  it('never charges a null-id message per message — it cannot be deduplicated', () => {
    H.recordMessageCost(messageUsage(null));
    H.recordMessageCost(messageUsage(null));
    expect(H.getState().costSpentUsd).toBe(0);
    expect(H.getState().turnMissingIdCount).toBe(2);
    // …but the turn is DEGRADED, so the residual settles it rather than dropping it.
    H.recordTurnCost(usage(9));
    expect(H.getState().costSpentUsd).toBeCloseTo(9, 8);
  });

  it('charges a residual for an unpriced model rather than silently dropping it', () => {
    H.recordMessageCost(messageUsage('m1'));
    H.recordMessageCost(messageUsage('m2', { model: 'some-unreleased-model' }));
    // The unknown model falls back to the CONFIGURED model, which prices fine —
    // so this turn is fully accounted and no residual is owed.
    expect(H.getState().turnUnpricedCount).toBe(0);
    expect(H.getState().costSpentUsd).toBeCloseTo(ONE_RESPONSE_USD * 2, 8);
  });

  it('counts a message as unpriced only when NEITHER model has a rate, then settles the residual', () => {
    __setConfigForTest(cfg({ model: 'also-unknown' }));
    seed();
    H.recordMessageCost(messageUsage('m1', { model: MODEL })); // priced
    H.recordMessageCost(messageUsage('m2', { model: 'nope' })); // unpriced both ways
    expect(H.getState().turnUnpricedCount).toBe(1);
    const charged = H.getState().costSpentUsd;
    expect(charged).toBeCloseTo(ONE_RESPONSE_USD, 8);
    // Residual = max(totalCostUsd, aggregate-priced) - already charged.
    H.recordTurnCost(usage(ONE_RESPONSE_USD * 3));
    expect(H.getState().costSpentUsd).toBeCloseTo(ONE_RESPONSE_USD * 3, 8);
  });

  it('a zero-token message is not "unpriced" — it legitimately costs $0', () => {
    H.recordMessageCost(
      messageUsage('m1', {
        model: 'unknown-model',
        inputTokens: 0,
        outputTokens: 0,
        cacheCreationInputTokens: 0,
        cacheReadInputTokens: 0,
      }),
    );
    expect(H.getState().turnUnpricedCount).toBe(0);
    expect(H.getState().turnSawMessageUsage).toBe(true);
  });

  it('resets per-turn state at every aggregate event so a turn never inherits the last one', () => {
    H.recordMessageCost(messageUsage(null));
    H.recordTurnCost(usage(1));
    const s = H.getState();
    expect(s.turnSawMessageUsage).toBe(false);
    expect(s.turnMessageCostUsd).toBe(0);
    expect(s.turnUnpricedCount).toBe(0);
    expect(s.turnMissingIdCount).toBe(0);
  });

  it('closes the zero-residual hole when the provider reports totalCostUsd as 0', () => {
    __setConfigForTest(cfg({ model: 'also-unknown' }));
    seed();
    H.recordMessageCost(messageUsage('m1', { model: 'nope' })); // unpriced
    expect(H.getState().costSpentUsd).toBe(0);
    // totalCostUsd is 0, but the aggregate tokens price to something under the
    // configured model — take the larger of the two, never nothing.
    H.recordTurnCost({ ...usage(0), ...RESPONSE_TOKENS });
    expect(H.getState().costSpentUsd).toBe(0); // configured model is unknown too → genuinely $0

    __setConfigForTest(cfg());
    seed();
    H.setState({ turnSawMessageUsage: true, turnMissingIdCount: 1 });
    H.recordTurnCost({ ...usage(0), ...RESPONSE_TOKENS });
    expect(H.getState().costSpentUsd).toBeCloseTo(ONE_RESPONSE_USD, 8);
  });
});

describe('#1327 — window resets clear per-message state', () => {
  it('/clear drops the seen-id set and re-arms the codex baseline', () => {
    H.recordMessageCost(messageUsage('m1'));
    expect(H.getState().seenMessageIdCount).toBe(1);

    H.resetCostForNewSession();

    const s = H.getState();
    expect(s.costSpentUsd).toBe(0);
    expect(s.seenMessageIdCount).toBe(0);
    expect(s.codexLedgerBaselinePending).toBe(true);
    expect(s.codexUsdCharged).toBe(0);
    // The same id can be charged again — it belongs to a different budget window.
    H.recordMessageCost(messageUsage('m1'));
    expect(H.getState().costSpentUsd).toBeCloseTo(ONE_RESPONSE_USD, 8);
  });
});

// ---------------------------------------------------------------------------
// Codex fold
// ---------------------------------------------------------------------------

const D_TODAY = new Date().toISOString().slice(0, 10);

describe('#1327 — codex MCP-tool spend folded into the cap', () => {
  let home: string;
  let prevHome: string | undefined;

  function writeRollout(day: string, name: string, entries: Array<{ ts: string; input: number; output?: number }>) {
    const [y, m, d] = day.split('-');
    const dir = path.join(home, 'sessions', y, m, d);
    fs.mkdirSync(dir, { recursive: true });
    const lines = [
      JSON.stringify({
        timestamp: `${day}T00:00:00.000Z`,
        type: 'turn_context',
        payload: { cwd: '/workspace/agent', model: 'gpt-5.6-sol' },
      }),
      ...entries.map((e) =>
        JSON.stringify({
          timestamp: e.ts,
          type: 'event_msg',
          payload: {
            type: 'token_count',
            info: {
              total_token_usage: {
                input_tokens: e.input,
                cached_input_tokens: 0,
                cache_write_input_tokens: 0,
                output_tokens: e.output ?? 0,
                reasoning_output_tokens: 0,
                total_tokens: e.input + (e.output ?? 0),
              },
            },
          },
        }),
      ),
    ];
    const p = path.join(dir, `rollout-${day}T10-00-00-${name}.jsonl`);
    fs.writeFileSync(p, lines.join('\n'));
    return p;
  }

  beforeEach(() => {
    prevHome = process.env.CODEX_HOME;
    home = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-fold-'));
    process.env.CODEX_HOME = home;
    __resetCodexCostMemo();
  });

  afterEach(() => {
    if (prevHome === undefined) delete process.env.CODEX_HOME;
    else process.env.CODEX_HOME = prevHome;
    fs.rmSync(home, { recursive: true, force: true });
  });

  it('charges codex spend that the provider stream never sees', () => {
    writeRollout(D_TODAY, 'aaa', [{ ts: `${D_TODAY}T10:00:00.000Z`, input: 1_000_000 }]);
    H.foldCodexCost();
    expect(H.getState().costSpentUsd).toBeCloseTo(5, 6); // 1M non-cached input @ $5/M
    expect(H.getState().codexUsdCharged).toBeCloseTo(5, 6);
  });

  it('charges only the DELTA on a second fold, and nothing at all when idle', () => {
    const p = writeRollout(D_TODAY, 'aaa', [{ ts: `${D_TODAY}T10:00:00.000Z`, input: 1_000_000 }]);
    H.foldCodexCost();
    H.foldCodexCost(); // idle — must be a no-op
    expect(H.getState().costSpentUsd).toBeCloseTo(5, 6);

    fs.appendFileSync(
      p,
      '\n' +
        JSON.stringify({
          timestamp: `${D_TODAY}T11:00:00.000Z`,
          type: 'event_msg',
          payload: { type: 'token_count', info: { total_token_usage: { input_tokens: 3_000_000 } } },
        }),
    );
    __resetCodexCostMemo();
    H.foldCodexCost();
    expect(H.getState().costSpentUsd).toBeCloseTo(15, 6); // +$10, not +$15
  });

  it('a NEW file charges immediately even after another file is deleted', () => {
    // The failure a single global high-water mark has: delete the file that set
    // the mark and subsequent real spend has to climb back past it first.
    const p = writeRollout(D_TODAY, 'aaa', [{ ts: `${D_TODAY}T10:00:00.000Z`, input: 20_000_000 }]);
    H.foldCodexCost();
    expect(H.getState().costSpentUsd).toBeCloseTo(100, 6);

    fs.rmSync(p);
    __resetCodexCostMemo();
    writeRollout(D_TODAY, 'bbb', [{ ts: `${D_TODAY}T12:00:00.000Z`, input: 1_000_000 }]);
    H.foldCodexCost();
    expect(H.getState().costSpentUsd).toBeCloseTo(105, 6); // the $5 is charged, not swallowed
  });

  it('prunes only watermarks whose file is gone AND older than the retention window', () => {
    writeRollout(D_TODAY, 'live', [{ ts: `${D_TODAY}T10:00:00.000Z`, input: 1_000_000 }]);
    seed({
      codexLedger: {
        // gone + ancient → pruned
        '2000/01/01/rollout-old.jsonl 2000-01-01': 3,
        // gone but recent → kept (a restore is still plausible)
        [`2026/01/01/rollout-recent.jsonl ${D_TODAY}`]: 4,
      },
    });
    H.foldCodexCost();
    const ledger = H.getState().codexLedger;
    expect(ledger['2000/01/01/rollout-old.jsonl 2000-01-01']).toBeUndefined();
    expect(ledger[`2026/01/01/rollout-recent.jsonl ${D_TODAY}`]).toBeCloseTo(4, 8);
    // …and the live file's own watermark was written, not pruned.
    expect(Object.keys(ledger).some((k) => k.includes('rollout-' + D_TODAY + 'T10-00-00-live'))).toBe(true);
  });

  it('never prunes a watermark whose file is still on disk', () => {
    const p = writeRollout(D_TODAY, 'aaa', [{ ts: `${D_TODAY}T10:00:00.000Z`, input: 1_000_000 }]);
    H.foldCodexCost();
    expect(H.getState().costSpentUsd).toBeCloseTo(5, 6);
    // Backdate the file's mtime is irrelevant — presence is what protects it.
    expect(fs.existsSync(p)).toBe(true);
    H.foldCodexCost();
    expect(H.getState().costSpentUsd).toBeCloseTo(5, 6); // no re-charge
  });

  it('a deleted file cannot re-charge if it comes back', () => {
    const p = writeRollout(D_TODAY, 'aaa', [{ ts: `${D_TODAY}T10:00:00.000Z`, input: 1_000_000 }]);
    H.foldCodexCost();
    const content = fs.readFileSync(p, 'utf-8');
    fs.rmSync(p);
    __resetCodexCostMemo();
    H.foldCodexCost();
    fs.writeFileSync(p, content);
    __resetCodexCostMemo();
    H.foldCodexCost();
    expect(H.getState().costSpentUsd).toBeCloseTo(5, 6);
  });

  it('the daily window records a PRIOR-day delta without charging it to today', () => {
    seed({ costImmortal: true, costWindow: 'daily', costDayKey: D_TODAY });
    writeRollout('2020-01-02', 'old', [{ ts: '2020-01-02T10:00:00.000Z', input: 1_000_000 }]);
    writeRollout(D_TODAY, 'new', [{ ts: `${D_TODAY}T10:00:00.000Z`, input: 2_000_000 }]);
    H.foldCodexCost();
    // Only today's $10 is charged; yesterday's $5 is recorded into the ledger.
    expect(H.getState().costSpentUsd).toBeCloseTo(10, 6);
    expect(Object.keys(H.getState().codexLedger)).toHaveLength(2);
  });

  it('first upgrade BASELINES existing history instead of retroactively billing it', () => {
    writeRollout(D_TODAY, 'aaa', [{ ts: `${D_TODAY}T10:00:00.000Z`, input: 20_000_000 }]);
    seed({ codexLedgerBaselinePending: true });
    H.foldCodexCost();
    expect(H.getState().costSpentUsd).toBe(0); // absorbed, not charged
    expect(H.getState().codexLedgerBaselinePending).toBe(false);

    // …and NEW spend after the baseline is charged normally.
    writeRollout(D_TODAY, 'bbb', [{ ts: `${D_TODAY}T12:00:00.000Z`, input: 1_000_000 }]);
    H.foldCodexCost();
    expect(H.getState().costSpentUsd).toBeCloseTo(5, 6);
  });

  it('does NOT baseline off an incomplete scan', () => {
    const p = writeRollout(D_TODAY, 'aaa', [{ ts: `${D_TODAY}T10:00:00.000Z`, input: 1_000_000 }]);
    fs.chmodSync(p, 0o000);
    seed({ codexLedgerBaselinePending: true });
    H.foldCodexCost();
    fs.chmodSync(p, 0o644);
    // Still pending — a partial absorb would strand the unread file's spend.
    expect(H.getState().codexLedgerBaselinePending).toBe(true);
  });

  it('charges an unreadable file in full once it becomes readable', () => {
    const p = writeRollout(D_TODAY, 'aaa', [{ ts: `${D_TODAY}T10:00:00.000Z`, input: 1_000_000 }]);
    fs.chmodSync(p, 0o000);
    H.foldCodexCost();
    expect(H.getState().costSpentUsd).toBe(0);
    fs.chmodSync(p, 0o644);
    __resetCodexCostMemo();
    H.foldCodexCost();
    expect(H.getState().costSpentUsd).toBeCloseTo(5, 6); // nothing was lost
  });

  it('a codex-only ceiling crossing quiesces the session', () => {
    seed({ costCeilingUsd: 3, costCapUsd: 1000, costAllotmentUsd: 1000 });
    writeRollout(D_TODAY, 'aaa', [{ ts: `${D_TODAY}T10:00:00.000Z`, input: 1_000_000 }]);
    H.foldCodexCost();
    expect(H.getState().costStopRequested).toBe(true);
    expect(H.computeCostStatus()).toBe('stopped');
    expect(escalations('ceiling')).toHaveLength(1);
  });

  it('does nothing when cost tracking is off', () => {
    seed({ costEnabled: false });
    writeRollout(D_TODAY, 'aaa', [{ ts: `${D_TODAY}T10:00:00.000Z`, input: 1_000_000 }]);
    H.foldCodexCost();
    expect(H.getState().costSpentUsd).toBe(0);
  });
});

describe('#1327 — persistence + respawn', () => {
  it('round-trips the ledger, baseline marker and accounting version through the DB', () => {
    seed({ codexLedger: { 'a.jsonl 2026-08-18': 1.25 }, codexUsdCharged: 1.25 });
    H.recordMessageCost(messageUsage('m1'));

    const persisted = getCostCap();
    expect(persisted?.accountingVersion).toBe(2);
    expect(persisted?.codexLedger).toEqual({ 'a.jsonl 2026-08-18': 1.25 });
    expect(persisted?.codexBaselinePending).toBe(false);
    expect(persisted?.codexUsd).toBeCloseTo(1.25, 8);
  });

  it('a respawn adopts the persisted ledger and does not owe a baseline', () => {
    setCostCap({
      capUsd: 50,
      spentUsd: 12,
      status: 'ok',
      immortal: false,
      window: 'lifetime',
      ceilingUsd: 100,
      accountingVersion: 2,
      codexUsd: 4,
      codexLedger: { 'a.jsonl 2026-08-18': 4 },
      codexBaselinePending: false,
    });
    __setConfigForTest(cfg({ costCapT2Usd: 50, costCeilingT2Usd: 100 } as Partial<RunnerConfig>));
    H.initCostTracking('claude');
    const s = H.getState();
    expect(s.codexLedgerBaselinePending).toBe(false);
    expect(s.codexUsdCharged).toBeCloseTo(4, 8);
    expect(s.codexLedger['a.jsonl 2026-08-18']).toBeCloseTo(4, 8);
  });

  it('a pre-#1327 row (no ledger, no version) still owes a baseline', () => {
    setCostCap({
      capUsd: 50,
      spentUsd: 166,
      status: 'escalated',
      immortal: false,
      window: 'lifetime',
      ceilingUsd: 100,
    });
    __setConfigForTest(cfg({ costCapT2Usd: 50, costCeilingT2Usd: 100 } as Partial<RunnerConfig>));
    H.initCostTracking('claude');
    expect(H.getState().codexLedgerBaselinePending).toBe(true);
    // The inflated pre-fix spend is RETAINED, not rescaled.
    expect(H.getState().costSpentUsd).toBeCloseTo(166, 8);
  });

  it('a crash between init and the first fold still owes a baseline (explicit marker)', () => {
    // init persists an EMPTY ledger before the fold runs; without the explicit
    // marker the successor would read "ledger present" and bill all history.
    setCostCap({
      capUsd: 50,
      spentUsd: 3,
      status: 'ok',
      immortal: false,
      window: 'lifetime',
      ceilingUsd: 100,
      accountingVersion: 2,
      codexLedger: {},
      codexBaselinePending: true,
    });
    __setConfigForTest(cfg({ costCapT2Usd: 50, costCeilingT2Usd: 100 } as Partial<RunnerConfig>));
    H.initCostTracking('claude');
    expect(H.getState().codexLedgerBaselinePending).toBe(true);
  });
});
