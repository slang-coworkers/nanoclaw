/**
 * Per-session two-tier cost cap state machine (NanoClaw #1, v2).
 *
 * The accounting lives in module-private singletons inside poll-loop.ts
 * (recordTurnCost / computeCostStatus / applyCostOverride /
 * resetCostForNewSession / initCostTracking / emitCostEscalation), reachable
 * here only through the additive `__costCapTestHooks` seam. CodeRabbit flagged
 * this state machine as untested; these table-driven cases pin exactly the
 * behaviors the ceiling review just landed:
 *
 *   (a) Tier-1: non-immortal at/over cap (< ceiling) → 'escalated', one 'cap'.
 *   (b) Tier-2: non-immortal at/over ceiling → 'stopped', hard-stop flag, one
 *       'ceiling' alert, and NO duplicate 'cap' alert on the same crossing.
 *   (c) Immortal at/over ceiling → never 'stopped', re-escalates once, and
 *       re-arms after a UTC-day rollover so day-2 re-escalates.
 *   (d) 'continue' below the ceiling raises the cap + clears the stop; 'continue'
 *       at/over the ceiling for a non-immortal group is IGNORED (stop stays).
 *   (e) resetCostForNewSession clears the ceiling flags.
 *   (f) initCostTracking marks stop when persisted spend already exceeds a
 *       newly-lowered ceiling (the "one free turn" fix); immortal never does.
 *
 * NO module mocks. `mock.module()` is process-global in bun:test and leaks into
 * sibling files (poll-loop.test.ts), so instead we drive the REAL in-memory
 * session DB (initTestSessionDb) — setCostCap and the escalation's writeMessageOut
 * run for real, and escalations are counted by reading the real outbound DB.
 * The one non-DB dependency, getConfig(), is set via the additive
 * __setConfigForTest seam and restored to its pristine null in teardown, so
 * nothing leaks. Pricing stays real: all-zero-token events price to $0, so
 * recordTurnCost falls back to the event's totalCostUsd — a precise spend knob.
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';

import { closeSessionDb, initTestSessionDb } from './mailbox/sqlite/connection.js';
import { getUndeliveredMessages } from './db/messages-out.js';
import { getCostCap, setCostCap } from './db/session-state.js';
import { __setConfigForTest } from './config.js';
import { __costCapTestHooks as H } from './poll-loop.js';
import type { RunnerConfig } from './config.js';
import type { MessageInRow } from './db/messages-in.js';
import type { ProviderEvent } from './providers/types.js';

/** A minimal loaded RunnerConfig; override the cost fields per test. */
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

/** Seed the module cost accumulator directly (bypasses initCostTracking). */
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

/** A usage event whose only priced signal is totalCostUsd (all tokens zero). */
function usage(costUsd: number): Extract<ProviderEvent, { type: 'usage' }> {
  return {
    type: 'usage',
    inputTokens: 0,
    outputTokens: 0,
    cacheCreationInputTokens: 0,
    cacheReadInputTokens: 0,
    ephemeral1hInputTokens: 0,
    ephemeral5mInputTokens: 0,
    durationMs: 0,
    totalCostUsd: costUsd,
    numTurns: 1,
    sessionId: null,
  };
}

/** cost_escalation rows on the real outbound DB, optionally filtered by reason. */
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

/** A cost_override inbound row carrying `{ decision }` (legacy — no epoch fence). */
function override(decision: 'continue' | 'stop'): MessageInRow {
  return { id: `ov-${decision}`, content: JSON.stringify({ decision }) } as unknown as MessageInRow;
}

/** A cost_override inbound row carrying `{ decision, epochKey }` (fenced, card path). */
function fencedOverride(decision: 'continue' | 'stop', epochKey: number | string): MessageInRow {
  return {
    id: `ov-${decision}-${epochKey}`,
    content: JSON.stringify({ decision, epochKey: String(epochKey) }),
  } as unknown as MessageInRow;
}

/** The persisted cost_cap row on the real outbound DB (what the host reads). */
function persistedCap() {
  return getCostCap();
}

const todayUtc = () => new Date().toISOString().slice(0, 10);

beforeEach(() => {
  initTestSessionDb();
  // Benign default so recordTurnCost's getConfig().model resolves (value is
  // irrelevant — all-zero-token events price to $0 and fall back to totalCostUsd).
  __setConfigForTest(cfg());
  seed();
});

afterEach(() => {
  __setConfigForTest(null); // restore pristine — nothing leaks to sibling files
  closeSessionDb();
});

describe('two-tier cost cap — Tier-1 soft escalation (a)', () => {
  it('non-immortal spend ≥ cap but < ceiling → escalated, exactly one "cap" escalation', () => {
    seed({ costCeilingUsd: 100 });

    H.recordTurnCost(usage(12)); // over the $10 cap, well under the $100 ceiling

    const s = H.getState();
    expect(H.computeCostStatus()).toBe('escalated');
    expect(s.costSpentUsd).toBeCloseTo(12);
    expect(s.costStopRequested).toBe(false);
    expect(s.costCeilingHardStop).toBe(false);
    expect(escalations('cap')).toHaveLength(1);
    expect(escalations('ceiling')).toHaveLength(0);
  });

  it('a second over-cap turn does NOT re-escalate (once per allotment via escalatedAt)', () => {
    seed({ costCeilingUsd: 100 });
    H.recordTurnCost(usage(12));
    H.recordTurnCost(usage(5));
    expect(escalations('cap')).toHaveLength(1);
    expect(H.getState().costSpentUsd).toBeCloseTo(17);
  });
});

describe('two-tier cost cap — Tier-2 hard ceiling, non-immortal (b)', () => {
  it('spend ≥ ceiling → stopped + hard-stop flag; one "ceiling" alert, no duplicate "cap"', () => {
    seed({ costCeilingUsd: 50 });

    H.recordTurnCost(usage(60)); // one pathological turn crosses BOTH cap and ceiling

    const s = H.getState();
    expect(H.computeCostStatus()).toBe('stopped');
    expect(s.costCeilingHardStop).toBe(true);
    expect(s.costStopRequested).toBe(true);
    expect(escalations('ceiling')).toHaveLength(1);
    // The ceiling alert suppresses the near-identical Tier-1 'cap' alert this turn.
    expect(escalations('cap')).toHaveLength(0);
    expect(escalations()).toHaveLength(1);
    // escalatedAt is still stamped for dedup even though the 'cap' alert was skipped.
    expect(s.costEscalatedAt).toBeDefined();
  });
});

describe('two-tier cost cap — immortal ceiling never blocks, re-arms daily (c)', () => {
  it('immortal at/over ceiling → escalated (not stopped), re-escalates once, re-arms after UTC-day rollover', () => {
    seed({ costImmortal: true, costWindow: 'daily', costDayKey: todayUtc(), costCeilingUsd: 50 });

    // Day 1 crossing.
    H.recordTurnCost(usage(60));
    expect(H.computeCostStatus()).toBe('escalated'); // immortal is NEVER 'stopped'
    expect(H.getState().costStopRequested).toBe(false);
    expect(H.getState().costCeilingHardStop).toBe(false);
    expect(escalations('ceiling')).toHaveLength(1);

    // Still over ceiling, same day → deduped, no new alert.
    H.recordTurnCost(usage(5));
    expect(escalations('ceiling')).toHaveLength(1);

    // Backdate the day bucket to force a UTC-day rollover, then cross again.
    H.setState({ costDayKey: '2000-01-01' });
    H.recordTurnCost(usage(60));

    expect(H.getState().costWindow).toBe('daily');
    expect(H.getState().costDayKey).toBe(todayUtc()); // rolled to today
    expect(escalations('ceiling')).toHaveLength(2); // re-armed → day-2 crossing re-escalates
    expect(H.computeCostStatus()).toBe('escalated');
  });
});

describe('two-tier cost cap — applyCostOverride (d)', () => {
  it('continue below the ceiling raises the cap by one allotment and clears the stop', () => {
    seed({ costCeilingUsd: 100 });
    H.recordTurnCost(usage(12)); // escalated (over cap, under ceiling)

    H.applyCostOverride(override('stop'));
    expect(H.getState().costStopRequested).toBe(true);

    H.applyCostOverride(override('continue'));
    const s = H.getState();
    expect(s.costStopRequested).toBe(false);
    expect(s.costCapUsd).toBeCloseTo(20); // $10 base + one $10 allotment
    expect(s.costEscalatedAt).toBeUndefined(); // re-armed for the raised cap
    expect(s.costDecision).toBe('continue');
  });

  it('continue at/over the ceiling RAISES the ceiling by one allotment, clears the stop, and queues a cost nudge', () => {
    seed({ costCeilingUsd: 50, costCeilingAllotmentUsd: 50 });
    H.recordTurnCost(usage(60)); // over ceiling → hard stop
    expect(H.getState().costCeilingHardStop).toBe(true);
    const genBefore = H.getState().costBudgetGen;

    H.applyCostOverride(override('continue'));

    const s = H.getState();
    expect(s.costStopRequested).toBe(false); // resumed
    expect(s.costCeilingHardStop).toBe(false); // hard-stop marker cleared too
    expect(s.costCeilingUsd).toBeCloseTo(100); // $50 base + one $50 allotment — bounded, not unbounded
    expect(s.costDecision).toBe('continue');
    expect(s.costBudgetGen).toBe(genBefore + 1); // re-armed, same as the cap-continue path
    // Status reads 'escalated', not 'stopped': the (untouched, no-longer-carded)
    // Tier-1 cap is still $10 and spend ($60) is still over it — only the ceiling
    // hard-stop was resolved.
    expect(H.computeCostStatus()).toBe('escalated');
    // A one-shot cost-sensitivity note is queued for the next real turn.
    expect(s.pendingCostNudge).toBeDefined();
    expect(s.pendingCostNudge).toContain('$60.00');
    expect(s.pendingCostNudge).toContain('$100.00');
  });

  it('a session that burns through the raise re-stops and re-cards (bounded, not a blank check)', () => {
    seed({ costCeilingUsd: 50, costCeilingAllotmentUsd: 50 });
    H.recordTurnCost(usage(60)); // over ceiling → hard stop at $50
    H.applyCostOverride(override('continue')); // ceiling → $100
    expect(H.getState().costCeilingUsd).toBeCloseTo(100);

    H.recordTurnCost(usage(45)); // $105 total → over the raised $100 ceiling again
    const s = H.getState();
    expect(s.costCeilingHardStop).toBe(true);
    expect(s.costStopRequested).toBe(true);
    expect(escalations('ceiling')).toHaveLength(2); // re-armed → crosses again → cards again

    // A second approve raises by the SAME fixed allotment (arithmetic, not compounding).
    H.applyCostOverride(override('continue'));
    expect(H.getState().costCeilingUsd).toBeCloseTo(150); // 100 + 50, not 100 + 100
  });

  it('continue is a no-op on costCeilingUsd for an immortal group (immortal never hard-stops, so never hits this branch)', () => {
    seed({ costImmortal: true, costWindow: 'daily', costDayKey: todayUtc(), costCeilingUsd: 50, costCeilingAllotmentUsd: 50 });
    H.recordTurnCost(usage(60)); // immortal: escalated, never stopped
    expect(H.computeCostStatus()).toBe('escalated');

    H.applyCostOverride(override('continue'));

    // Falls through to the legacy cap-raise path — the ceiling itself is untouched.
    expect(H.getState().costCeilingUsd).toBeCloseTo(50);
    expect(H.getState().pendingCostNudge).toBeUndefined();
  });
});

describe('two-tier cost cap — resetCostForNewSession clears ceiling flags (e)', () => {
  it('a new session zeroes spend and clears the hard-stop + one-shot ceiling flags', () => {
    seed({ costCeilingUsd: 50 });
    H.recordTurnCost(usage(60)); // over ceiling → hard-stop flag set
    expect(H.getState().costCeilingHardStop).toBe(true);
    // Also arm the immortal one-shot so we prove reset clears it too.
    H.setState({ costCeilingEscalated: true });

    H.resetCostForNewSession();

    const s = H.getState();
    expect(s.costCeilingHardStop).toBe(false);
    expect(s.costCeilingEscalated).toBe(false);
    expect(s.costStopRequested).toBe(false);
    expect(s.costEscalatedAt).toBeUndefined();
    expect(s.costSpentUsd).toBe(0);
    expect(s.costCapUsd).toBeCloseTo(10);
    expect(s.costDecision).toBeUndefined();
    expect(H.computeCostStatus()).toBe('ok');
  });

  it('a new session also reverts a raised ceiling to its base allotment and drops any queued nudge', () => {
    seed({ costCeilingUsd: 50, costCeilingAllotmentUsd: 50 });
    H.recordTurnCost(usage(60)); // over ceiling → hard stop
    H.applyCostOverride(override('continue')); // ceiling raised to $100, nudge queued
    expect(H.getState().costCeilingUsd).toBeCloseTo(100);
    expect(H.getState().pendingCostNudge).toBeDefined();

    H.resetCostForNewSession();

    const s = H.getState();
    expect(s.costCeilingUsd).toBeCloseTo(50); // back to the base allotment, not the raised value
    expect(s.pendingCostNudge).toBeUndefined(); // a fresh window makes the stale nudge moot
  });
});

describe('two-tier cost cap — initCostTracking derives stop from spend-vs-ceiling on load (f)', () => {
  it('non-immortal: persisted spend past a newly-lowered ceiling loads already-stopped (no free turn)', () => {
    // Persisted BEFORE the ceiling existed → status was 'escalated', not 'stopped'.
    setCostCap({ capUsd: 10, spentUsd: 60, status: 'escalated', immortal: false, window: 'lifetime' });
    // Ceiling newly enabled / lowered to $50 — the session already exceeds it.
    __setConfigForTest(cfg({ immortal: false, costCapT2Usd: 10, costCeilingT2Usd: 50 }));

    H.initCostTracking('claude');

    const s = H.getState();
    expect(s.costSpentUsd).toBeCloseTo(60);
    expect(s.costStopRequested).toBe(true); // the fix: quiesce marker keyed off spend, not status
    expect(H.computeCostStatus()).toBe('stopped');
  });

  it('immortal: persisted spend past the ceiling is never marked stopped on load', () => {
    setCostCap({
      capUsd: 10,
      spentUsd: 60,
      status: 'escalated',
      immortal: true,
      window: 'daily',
      dayKey: todayUtc(), // same UTC day so the persisted spend is adopted
    });
    __setConfigForTest(cfg({ immortal: true, costCapT2Usd: 10, costCeilingT2Usd: 50 }));

    H.initCostTracking('claude');

    expect(H.getState().costSpentUsd).toBeCloseTo(60);
    expect(H.getState().costStopRequested).toBe(false);
    expect(H.computeCostStatus()).toBe('escalated');
  });

  it('a respawn adopts a previously-raised ceiling (survives container restart) instead of the base allotment', () => {
    // Persisted state from before a respawn: a ceiling-continue already raised
    // ceilingUsd to $100 (base allotment is $50 per container.json).
    setCostCap({ capUsd: 10, spentUsd: 90, ceilingUsd: 100, status: 'ok', immortal: false, window: 'lifetime' });
    __setConfigForTest(cfg({ immortal: false, costCapT2Usd: 10, costCeilingT2Usd: 50 }));

    H.initCostTracking('claude');

    const s = H.getState();
    expect(s.costCeilingUsd).toBeCloseTo(100); // adopted the raised value, not re-derived from cfg
    expect(s.costStopRequested).toBe(false); // $90 spend is still under the raised $100 ceiling
  });

  it('a respawn with no persisted ceiling falls back to the config allotment', () => {
    setCostCap({ capUsd: 10, spentUsd: 5, status: 'ok', immortal: false, window: 'lifetime' });
    __setConfigForTest(cfg({ immortal: false, costCapT2Usd: 10, costCeilingT2Usd: 50 }));

    H.initCostTracking('claude');

    expect(H.getState().costCeilingUsd).toBeCloseTo(50);
  });
});

describe('two-tier cost cap — FIX #4: only the Claude provider accrues', () => {
  it('a non-claude provider leaves the cap disabled — no accrual, no escalation', () => {
    __setConfigForTest(cfg({ immortal: false, costCapT2Usd: 10, costCeilingT2Usd: 50 }));

    H.initCostTracking('opencode');
    expect(H.getState().costEnabled).toBe(false);

    H.recordTurnCost(usage(999));

    expect(H.getState().costSpentUsd).toBe(0);
    expect(escalations()).toHaveLength(0);
  });
});

/**
 * Budget-generation GRANT fence (cost-approval card, money-safety).
 *
 * The card lets a human enqueue at most one `cost_override` per episode (the host
 * central CAS), but delivery is at-least-once: a host crash between CAS-commit and
 * enqueue-retry can re-deliver the SAME override. The runner's exactly-once guarantee
 * is a monotonic `budgetGen`: an escalation stamps its episode with the gen live at
 * escalation; an override carries that gen as `epochKey`; applyCostOverride refuses any
 * whose epoch ≠ the current gen. Applying a Continue rotates the gen, so a re-enqueue is
 * auto-stale — and any epoch-changing event (/clear, new_session, daily rollover) also
 * rotates it, closing the one money-unsafe path v8 had (a decision landing after a reset).
 * These cases pin: no double-grant, no post-reset/rollover stale apply, no stale-Stop
 * quiesce of a fresh session, legacy (no-epoch) back-compat, and the host-ingest contract.
 */
describe('two-tier cost cap — budget-generation grant fence (g)', () => {
  it('(g1) a re-enqueued Continue (same epoch) is REFUSED — grants exactly once, never twice', () => {
    seed({ costCeilingUsd: 100 });
    H.recordTurnCost(usage(12)); // escalate 'cap' at gen 0; episode stamped epoch "0"
    expect(H.getState().costBudgetGen).toBe(0);
    expect(H.computeCostStatus()).toBe('escalated');

    // Host resolves the episode → enqueues continue{epoch:"0"}. Applies: cap +$10, gen→1.
    H.applyCostOverride(fencedOverride('continue', 0));
    expect(H.getState().costCapUsd).toBeCloseTo(20);
    expect(H.getState().costBudgetGen).toBe(1);
    expect(H.getState().costEpisodeId).toBeUndefined(); // episode resolved → dropped
    expect(persistedCap()?.episodeId).toBeUndefined();

    // Host crash + retry re-delivers the IDENTICAL override. Its epoch "0" ≠ live gen 1.
    H.applyCostOverride(fencedOverride('continue', 0));
    expect(H.getState().costCapUsd).toBeCloseTo(20); // NOT 30 — the second grant is refused
    expect(H.getState().costBudgetGen).toBe(1); // refused → no rotation
  });

  it('(g2) a Continue that lands AFTER a /clear reset is REFUSED (the v8 money-unsafe path, closed)', () => {
    seed({ costCeilingUsd: 100 });
    H.recordTurnCost(usage(12)); // escalate at gen 0
    expect(H.getState().costBudgetGen).toBe(0);

    H.resetCostForNewSession(); // /clear → gen→1, fresh $10 cap, $0 spend
    expect(H.getState().costBudgetGen).toBe(1);
    expect(H.getState().costCapUsd).toBeCloseTo(10);

    // The pre-clear decision arrives late. Its epoch "0" ≠ live gen 1 → refused.
    H.applyCostOverride(fencedOverride('continue', 0));
    expect(H.getState().costCapUsd).toBeCloseTo(10); // NOT 20 — no grant on the cleared session
  });

  it('(g3) a yesterday-daily Continue is REFUSED after a UTC-day rollover rotates the gen', () => {
    seed({ costImmortal: true, costWindow: 'daily', costDayKey: todayUtc(), costCeilingUsd: 100 });
    H.recordTurnCost(usage(12)); // escalate 'cap' on day 1 at gen 0
    expect(H.getState().costBudgetGen).toBe(0);

    H.setState({ costDayKey: '2000-01-01' }); // backdate → force rollover on next turn
    H.recordTurnCost(usage(1)); // rollover: gen→1, spend reset, cap back to allotment
    expect(H.getState().costBudgetGen).toBe(1);
    const capAfterRollover = H.getState().costCapUsd;

    // Yesterday's decision (epoch "0") arrives today. "0" ≠ live gen 1 → refused.
    H.applyCostOverride(fencedOverride('continue', 0));
    expect(H.getState().costCapUsd).toBeCloseTo(capAfterRollover); // no cross-day grant
  });

  it('(g4) a LEGACY override with no epochKey applies unconditionally (dashboard-pill back-compat)', () => {
    // An escalated state at a non-zero gen; the pill path enqueues no epochKey.
    seed({ costCeilingUsd: 100, costBudgetGen: 7, costSpentUsd: 12, costEscalatedAt: 'x' });

    H.applyCostOverride(override('continue')); // no epochKey → fence is a no-op
    expect(H.getState().costCapUsd).toBeCloseTo(20); // applied despite gen 7
    expect(H.getState().costBudgetGen).toBe(8); // still re-arms after applying
  });

  it('(g5) a stale Stop (wrong epoch) is REFUSED — it cannot quiesce a fresh session', () => {
    seed({ costCeilingUsd: 100 });
    H.recordTurnCost(usage(12)); // escalate at gen 0
    H.resetCostForNewSession(); // fresh session, gen→1, not stopped
    expect(H.getState().costStopRequested).toBe(false);

    H.applyCostOverride(fencedOverride('stop', 0)); // pre-reset Stop, epoch "0" ≠ gen 1
    expect(H.getState().costStopRequested).toBe(false); // still running
    expect(H.computeCostStatus()).toBe('ok');
  });

  it('(g6) escalation stamps the episode id + persists budgetGen (host read-only ingest contract)', () => {
    seed({ costCeilingUsd: 100, costBudgetGen: 3 });
    H.recordTurnCost(usage(12)); // escalate 'cap' at gen 3

    expect(H.getState().costEpisodeId).toBeDefined();
    const cap = persistedCap();
    expect(cap?.status).toBe('escalated');
    expect(cap?.budgetGen).toBe(3); // host reads the same gen the runner fences on
    expect(cap?.episodeId).toBeDefined();
    expect(cap?.episodeId).toMatch(/^esc-.*-cap-3$/); // esc-<sid>-<reason>-<gen>
    // The outbox escalation carries the same epoch fence the override must echo back.
    const [row] = escalations('cap');
    const payload = JSON.parse(row.content) as { epochKey?: string; episodeId?: string };
    expect(payload.epochKey).toBe('3');
    expect(payload.episodeId).toBe(cap?.episodeId);
  });

  it('(g7) a correctly-fenced Continue at the LIVE gen still applies (fence is not over-eager)', () => {
    seed({ costCeilingUsd: 100, costBudgetGen: 5 });
    H.recordTurnCost(usage(12)); // escalate at gen 5

    H.applyCostOverride(fencedOverride('continue', 5)); // matches live gen → applies
    expect(H.getState().costCapUsd).toBeCloseTo(20);
    expect(H.getState().costBudgetGen).toBe(6);
    expect(H.getState().costStopRequested).toBe(false);
  });
});

describe('two-tier cost cap — ceiling soft-brake (maxBudgetUsd)', () => {
  it('non-immortal with a ceiling → remaining headroom, floored at $0.01, never below zero', () => {
    seed({ costCeilingUsd: 50, costSpentUsd: 30 });
    expect(H.costCeilingRemainingUsd()).toBeCloseTo(20); // 50 - 30

    seed({ costCeilingUsd: 50, costSpentUsd: 50 }); // exactly at the ceiling
    expect(H.costCeilingRemainingUsd()).toBeCloseTo(0.01); // floored, not 0/negative

    seed({ costCeilingUsd: 50, costSpentUsd: 80 }); // over (one pathological turn)
    expect(H.costCeilingRemainingUsd()).toBeCloseTo(0.01);
  });

  it('no brake when there is no ceiling, when disabled, or for an immortal group', () => {
    seed({ costCeilingUsd: 0 });
    expect(H.costCeilingRemainingUsd()).toBeUndefined(); // no ceiling configured

    seed({ costEnabled: false, costCeilingUsd: 50 });
    expect(H.costCeilingRemainingUsd()).toBeUndefined(); // cap disabled

    seed({ costImmortal: true, costWindow: 'daily', costCeilingUsd: 50, costSpentUsd: 10 });
    expect(H.costCeilingRemainingUsd()).toBeUndefined(); // immortal is never hard-stopped
  });
});
