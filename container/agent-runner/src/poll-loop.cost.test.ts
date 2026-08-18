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
 * Dependency doubles (mock.module MUST precede the poll-loop import, per Bun):
 *   - ./config.js          → getConfig returns a per-test mutable config.
 *   - ./db/session-state.js → in-memory persisted cost_cap row.
 *   - ./db/messages-out.js  → writeMessageOut spy = the escalation counter.
 * Pricing stays real: all-zero token events price to $0, so recordTurnCost
 * falls back to the event's totalCostUsd — a precise spend knob.
 */
import { describe, it, expect, beforeEach, mock } from 'bun:test';

import type { CostCapState } from './db/session-state.js';
import type { MessageInRow } from './db/messages-in.js';
import type { ProviderEvent } from './providers/types.js';

interface MockConfig {
  model?: string;
  immortal?: boolean;
  costCapT2Usd?: number;
  costCeilingT2Usd?: number;
}

// getConfig() drives immortality + cap + ceiling + model; mutated per test.
let mockConfig: MockConfig = { model: 'claude-opus-4-8' };
// The persisted session_state.cost_cap row initCostTracking loads at start.
let persistedCostRow: CostCapState | undefined;
// Every outbound row emitCostEscalation writes — the escalation spy.
const outbound: Array<{ kind: string; content: string }> = [];

mock.module('./config.js', () => ({
  getConfig: () => mockConfig,
  loadConfig: () => mockConfig,
}));

mock.module('./db/session-state.js', () => ({
  getCostCap: () => persistedCostRow,
  setCostCap: (s: CostCapState) => {
    persistedCostRow = s;
  },
  // Remaining session-state imports poll-loop pulls in but the cost path never
  // calls — stubbed so the named bindings resolve.
  clearContinuation: () => {},
  getContinuationAgeMs: () => null,
  clearCurrentInReplyTo: () => {},
  migrateLegacyContinuation: () => undefined,
  setContinuation: () => {},
  setCurrentInReplyTo: () => {},
}));

mock.module('./db/messages-out.js', () => ({
  writeMessageOut: (msg: { kind: string; content: string }) => {
    outbound.push(msg);
    return 1;
  },
  hasIdenticalSend: () => false,
  outboundWatermark: () => 0,
}));

// Import AFTER the mocks so poll-loop binds the doubles (Bun mock.module rule).
const { __costCapTestHooks: H } = await import('./poll-loop.js');

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

/** Escalation rows captured on the outbound spy, optionally by reason. */
function escalations(reason?: 'cap' | 'ceiling') {
  return outbound.filter((m) => {
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

/** A cost_override inbound row carrying `{ decision }`. */
function override(decision: 'continue' | 'stop'): MessageInRow {
  return { id: `ov-${decision}`, content: JSON.stringify({ decision }) } as unknown as MessageInRow;
}

const todayUtc = () => new Date().toISOString().slice(0, 10);

beforeEach(() => {
  outbound.length = 0;
  persistedCostRow = undefined;
  mockConfig = { model: 'claude-opus-4-8', immortal: false, costCapT2Usd: 10, costCeilingT2Usd: 0 };
  // Full reset — initCostTracking re-seeds most globals but NOT the two ceiling
  // one-shots, so clear everything to keep cases independent.
  H.setState({
    costEnabled: false,
    costImmortal: false,
    costWindow: 'lifetime',
    costDayKey: undefined,
    costAllotmentUsd: 0,
    costCapUsd: 0,
    costSpentUsd: 0,
    costEscalatedAt: undefined,
    costDecision: undefined,
    costDecidedAt: undefined,
    costStopRequested: false,
    costCeilingUsd: 0,
    costCeilingEscalated: false,
    costCeilingHardStop: false,
  });
});

describe('two-tier cost cap — Tier-1 soft escalation (a)', () => {
  it('non-immortal spend ≥ cap but < ceiling → escalated, exactly one "cap" escalation', () => {
    mockConfig = { model: 'claude-opus-4-8', immortal: false, costCapT2Usd: 10, costCeilingT2Usd: 100 };
    H.initCostTracking('claude');

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
    mockConfig = { model: 'claude-opus-4-8', immortal: false, costCapT2Usd: 10, costCeilingT2Usd: 100 };
    H.initCostTracking('claude');
    H.recordTurnCost(usage(12));
    H.recordTurnCost(usage(5));
    expect(escalations('cap')).toHaveLength(1);
    expect(H.getState().costSpentUsd).toBeCloseTo(17);
  });
});

describe('two-tier cost cap — Tier-2 hard ceiling, non-immortal (b)', () => {
  it('spend ≥ ceiling → stopped + hard-stop flag; one "ceiling" alert, no duplicate "cap"', () => {
    mockConfig = { model: 'claude-opus-4-8', immortal: false, costCapT2Usd: 10, costCeilingT2Usd: 50 };
    H.initCostTracking('claude');

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
    mockConfig = { model: 'claude-opus-4-8', immortal: true, costCapT2Usd: 10, costCeilingT2Usd: 50 };
    H.initCostTracking('claude');
    expect(H.getState().costWindow).toBe('daily');

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
    mockConfig = { model: 'claude-opus-4-8', immortal: false, costCapT2Usd: 10, costCeilingT2Usd: 100 };
    H.initCostTracking('claude');
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

  it('continue at/over the ceiling is IGNORED for a non-immortal group (stop stays, cap unchanged)', () => {
    mockConfig = { model: 'claude-opus-4-8', immortal: false, costCapT2Usd: 10, costCeilingT2Usd: 50 };
    H.initCostTracking('claude');
    H.recordTurnCost(usage(60)); // over ceiling → hard stop
    const capBefore = H.getState().costCapUsd;

    H.applyCostOverride(override('continue'));

    const s = H.getState();
    expect(s.costStopRequested).toBe(true); // still stopped — Continue can't buy past the ceiling
    expect(s.costCapUsd).toBe(capBefore); // cap NOT raised
    expect(s.costDecision).toBe('continue'); // decision still recorded for the UI
    expect(H.computeCostStatus()).toBe('stopped');
  });
});

describe('two-tier cost cap — resetCostForNewSession clears ceiling flags (e)', () => {
  it('a new session zeroes spend and clears the hard-stop + one-shot ceiling flags', () => {
    mockConfig = { model: 'claude-opus-4-8', immortal: false, costCapT2Usd: 10, costCeilingT2Usd: 50 };
    H.initCostTracking('claude');
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
});

describe('two-tier cost cap — initCostTracking derives stop from spend-vs-ceiling on load (f)', () => {
  it('non-immortal: persisted spend past a newly-lowered ceiling loads already-stopped (no free turn)', () => {
    // Persisted BEFORE the ceiling existed → status was 'escalated', not 'stopped'.
    persistedCostRow = { capUsd: 10, spentUsd: 60, status: 'escalated', immortal: false, window: 'lifetime' };
    // Ceiling newly enabled / lowered to $50 — the session already exceeds it.
    mockConfig = { model: 'claude-opus-4-8', immortal: false, costCapT2Usd: 10, costCeilingT2Usd: 50 };

    H.initCostTracking('claude');

    const s = H.getState();
    expect(s.costSpentUsd).toBeCloseTo(60);
    expect(s.costStopRequested).toBe(true); // the fix: quiesce marker keyed off spend, not status
    expect(H.computeCostStatus()).toBe('stopped');
  });

  it('immortal: persisted spend past the ceiling is never marked stopped on load', () => {
    persistedCostRow = {
      capUsd: 10,
      spentUsd: 60,
      status: 'escalated',
      immortal: true,
      window: 'daily',
      dayKey: todayUtc(), // same UTC day so the persisted spend is adopted
    };
    mockConfig = { model: 'claude-opus-4-8', immortal: true, costCapT2Usd: 10, costCeilingT2Usd: 50 };

    H.initCostTracking('claude');

    expect(H.getState().costSpentUsd).toBeCloseTo(60);
    expect(H.getState().costStopRequested).toBe(false);
    expect(H.computeCostStatus()).toBe('escalated');
  });
});

describe('two-tier cost cap — FIX #4: only the Claude provider accrues', () => {
  it('a non-claude provider leaves the cap disabled — no accrual, no escalation', () => {
    mockConfig = { model: 'claude-opus-4-8', immortal: false, costCapT2Usd: 10, costCeilingT2Usd: 50 };
    H.initCostTracking('opencode');
    expect(H.getState().costEnabled).toBe(false);

    H.recordTurnCost(usage(999));

    expect(H.getState().costSpentUsd).toBe(0);
    expect(escalations()).toHaveLength(0);
  });
});
