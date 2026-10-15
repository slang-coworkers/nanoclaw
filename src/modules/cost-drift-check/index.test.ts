/**
 * Daily cost-ledger drift check — scheduling + alert routing. The drift logic
 * itself is the Python script's (scripts/test_verify_cost_ledger.py); here the
 * script run is a stub and we pin: opt-in, once a day, single-flight, stamp
 * before run, PASS is silent, FAIL and "could not run" both reach the operator.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../delivery.js', () => ({ getDeliveryAdapter: () => null }));
vi.mock('../approvals/primitive.js', () => ({
  pickApprover: async () => [],
  pickApprovalDelivery: async () => null,
}));

import {
  _costDriftInFlight,
  _resetCostDriftCheckForTesting,
  DRIFT_CHECK_INTERVAL_MS,
  maybeStartCostDriftCheck,
  type DriftCheckDeps,
  type DriftCheckState,
  type DriftRunResult,
} from './index.js';

const NOW = Date.parse('2026-10-15T06:00:00Z');

function fleet(verdict: 'PASS' | 'FAIL', alerts: string[] = []): string {
  return JSON.stringify({
    mode: 'fleet',
    verdict,
    since: '2026-10-14T06:00:00Z',
    until: '2026-10-15T06:00:00Z',
    sessions_checked: 7,
    ledger_calls: 420,
    matched: 418,
    alerts,
    usd_matched: { ledger: 101.5, gateway_priced: 103.2, drift: -1.7, drift_pct: 1.65 },
    unmatched_gateway_by_group: {
      'ag-reviewer': { gateway_calls: 60, unmatched_gateway_calls: 12, unmatched_gateway_usd: 4.5 },
      'ag-fixer': { gateway_calls: 300, unmatched_gateway_calls: 0, unmatched_gateway_usd: 0 },
    },
  });
}

function makeDeps(result: DriftRunResult, opts: { enabled?: boolean; state?: DriftCheckState | null } = {}) {
  let state: DriftCheckState | null = opts.state ?? null;
  const writes: DriftCheckState[] = [];
  const sent: string[] = [];
  const runCheck = vi.fn(async () => result);
  const deps: DriftCheckDeps = {
    enabled: () => opts.enabled ?? true,
    now: () => NOW,
    readState: () => state,
    writeState: (s) => {
      state = s;
      writes.push(s);
    },
    runCheck,
    notifyOperator: async (text) => {
      sent.push(text);
      return true;
    },
  };
  return { deps, writes, sent, runCheck, state: () => state };
}

async function settle(): Promise<void> {
  await _costDriftInFlight();
}

describe('cost drift check', () => {
  beforeEach(() => _resetCostDriftCheckForTesting());
  afterEach(() => _resetCostDriftCheckForTesting());

  it('does nothing unless opted in', () => {
    const t = makeDeps({ code: 0, stdout: fleet('PASS'), stderr: '' }, { enabled: false });
    expect(maybeStartCostDriftCheck(t.deps)).toBe('disabled');
    expect(t.runCheck).not.toHaveBeenCalled();
    expect(t.writes).toHaveLength(0);
  });

  it('PASS is logged, not sent, and recorded', async () => {
    const t = makeDeps({ code: 0, stdout: fleet('PASS'), stderr: '' });
    expect(maybeStartCostDriftCheck(t.deps)).toBe('started');
    await settle();
    expect(t.sent).toEqual([]);
    expect(t.state()?.lastVerdict).toBe('PASS');
    expect(t.state()?.lastRunAt).toBe(new Date(NOW).toISOString());
  });

  it('FAIL DMs the operator with the alerts and reports nested CLI calls as info', async () => {
    const t = makeDeps({
      code: 2,
      stdout: fleet('FAIL', [
        'output tokens differ on 3/40 matched calls in ag-fixer/sess-1: ledger 24 vs gateway 2400',
      ]),
      stderr: '',
    });
    maybeStartCostDriftCheck(t.deps);
    await settle();
    expect(t.sent).toHaveLength(1);
    expect(t.sent[0]).toContain('output tokens differ on 3/40');
    expect(t.sent[0]).toContain('Not counted by design');
    expect(t.sent[0]).toContain('ag-reviewer 12 calls $4.50');
    expect(t.sent[0]).not.toContain('ag-fixer 0 calls');
    expect(t.state()?.lastVerdict).toBe('FAIL');
  });

  it('a check that cannot run is an alert too', async () => {
    const t = makeDeps({
      code: 1,
      stdout: '{"verdict":"ERROR","error":"gateway query failed: no such container"}',
      stderr: '',
    });
    maybeStartCostDriftCheck(t.deps);
    await settle();
    expect(t.sent).toHaveLength(1);
    expect(t.sent[0]).toContain('could not run');
    expect(t.sent[0]).toContain('no such container');
    expect(t.state()?.lastVerdict).toBe('ERROR');
  });

  it('exit code and verdict must agree: unparseable output is an ERROR, not a PASS', async () => {
    const t = makeDeps({ code: 0, stdout: 'Traceback (most recent call last):', stderr: 'boom' });
    maybeStartCostDriftCheck(t.deps);
    await settle();
    expect(t.state()?.lastVerdict).toBe('ERROR');
    expect(t.sent).toHaveLength(1);
  });

  it('runs once a day, and stamps before running', async () => {
    const recent = new Date(NOW - DRIFT_CHECK_INTERVAL_MS + 60_000).toISOString();
    const t = makeDeps({ code: 0, stdout: fleet('PASS'), stderr: '' }, { state: { lastRunAt: recent } });
    expect(maybeStartCostDriftCheck(t.deps)).toBe('not-due');
    expect(t.runCheck).not.toHaveBeenCalled();

    const old = new Date(NOW - DRIFT_CHECK_INTERVAL_MS).toISOString();
    const u = makeDeps({ code: 0, stdout: fleet('PASS'), stderr: '' }, { state: { lastRunAt: old } });
    expect(maybeStartCostDriftCheck(u.deps)).toBe('started');
    expect(u.writes[0]).toEqual({ lastRunAt: new Date(NOW).toISOString() });
    await settle();
  });

  it('is single-flight across sweep ticks', async () => {
    let release!: (r: DriftRunResult) => void;
    const t = makeDeps({ code: 0, stdout: '', stderr: '' });
    t.deps.runCheck = () => new Promise((r) => (release = r));
    // The stamp makes the second tick not-due anyway; clear it to prove the flight guard.
    const writeState = t.deps.writeState;
    t.deps.writeState = (s) => writeState({ ...s, lastRunAt: '' });
    expect(maybeStartCostDriftCheck(t.deps)).toBe('started');
    expect(maybeStartCostDriftCheck(t.deps)).toBe('in-flight');
    release({ code: 0, stdout: fleet('PASS'), stderr: '' });
    await settle();
  });
});
