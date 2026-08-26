/**
 * Pure-logic contract for the Sessions tab's live cost-ceiling control
 * (dashboard/public/app.js, dash-1 set-ceiling-v2): cent arithmetic, the
 * exact outgoing request shape, requestId reuse-vs-mint, and reconciling
 * pending/terminal state. Same "extract the shipped source and eval it"
 * approach as render-admin-sessions.test.ts — see that file's header comment
 * for why (app.js has no module exports; this tests the SHIPPED code).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = fs.readFileSync(path.join(HERE, 'public', 'app.js'), 'utf-8');

/** Extract one top-level `function <name>(...) { ... }` by brace-matching. */
function extractFn(name: string): string {
  const start = APP.indexOf(`function ${name}(`);
  expect(start, `${name} must exist in app.js`).toBeGreaterThan(-1);
  let depth = 0;
  let end = -1;
  for (let j = APP.indexOf('{', start); j < APP.length; j++) {
    if (APP[j] === '{') depth++;
    else if (APP[j] === '}') {
      depth--;
      if (depth === 0) {
        end = j + 1;
        break;
      }
    }
  }
  expect(end, `${name} must be brace-balanced`).toBeGreaterThan(-1);
  return APP.slice(start, end);
}

interface CeilingModule {
  centsToUsdInputStr: (cents: unknown) => string;
  parseUsdInputToCents: (str: unknown) => number | null;
  clampCeilingCents: (cents: unknown) => number;
  buildCeilingRequestBody: (
    requestId: string,
    targetCeilingCents: number,
    expectedEpochKey: string,
    expectedCeilingCents: number,
  ) => Record<string, unknown>;
  newCeilingRequestId: () => string;
  resolveCeilingRequestId: (
    priorInFlight: { requestId: string; targetCeilingCents: number; expectedEpochKey: string; expectedCeilingCents: number } | undefined,
    targetCeilingCents: number,
    expectedEpochKey: string,
    expectedCeilingCents: number,
  ) => string;
  reconcileCeilingPendingState: (sessions: unknown[]) => void;
  ceilingPending: Set<string>;
  ceilingInFlight: Map<string, { requestId: string; targetCeilingCents: number; expectedEpochKey: string; expectedCeilingCents: number }>;
  ceilingDrafts: Map<string, number>;
}

/** Builds one fresh module instance with its OWN state maps (the three
 *  module-scope Map/Set app.js declares alongside these functions) — each
 *  call gets independent state, same as a fresh page load would. */
function loadCeilingModule(): CeilingModule {
  const combined = [
    'const ceilingDrafts = new Map();',
    'const ceilingInFlight = new Map();',
    'const ceilingPending = new Set();',
    'const CEILING_MIN_CENTS = 1; const CEILING_MAX_CENTS = 100000; const CEILING_STEP_CENTS = 1000;',
    extractFn('centsToUsdInputStr'),
    extractFn('parseUsdInputToCents'),
    extractFn('clampCeilingCents'),
    extractFn('buildCeilingRequestBody'),
    extractFn('newCeilingRequestId'),
    extractFn('resolveCeilingRequestId'),
    extractFn('reconcileCeilingPendingState'),
  ].join('\n');
  const factory = new Function(
    `${combined}\nreturn { centsToUsdInputStr, parseUsdInputToCents, clampCeilingCents, buildCeilingRequestBody, newCeilingRequestId, resolveCeilingRequestId, reconcileCeilingPendingState, ceilingPending, ceilingInFlight, ceilingDrafts };`,
  ) as () => CeilingModule;
  return factory();
}

describe('cents <-> dollar-string arithmetic (no float drift)', () => {
  let m: CeilingModule;
  beforeEach(() => {
    m = loadCeilingModule();
  });

  it('centsToUsdInputStr formats cents as a plain 2-decimal string', () => {
    expect(m.centsToUsdInputStr(17500)).toBe('175.00');
    expect(m.centsToUsdInputStr(1)).toBe('0.01');
    expect(m.centsToUsdInputStr(100000)).toBe('1000.00');
  });
  it('centsToUsdInputStr returns "" for non-numeric input', () => {
    expect(m.centsToUsdInputStr(undefined)).toBe('');
    expect(m.centsToUsdInputStr(NaN)).toBe('');
  });

  it('parseUsdInputToCents parses whole dollars, decimals, and a leading $', () => {
    expect(m.parseUsdInputToCents('175')).toBe(17500);
    expect(m.parseUsdInputToCents('175.5')).toBe(17550);
    expect(m.parseUsdInputToCents('175.50')).toBe(17550);
    expect(m.parseUsdInputToCents('$91.00')).toBe(9100);
    expect(m.parseUsdInputToCents('  91  ')).toBe(9100);
    expect(m.parseUsdInputToCents('0.01')).toBe(1);
  });
  it('parseUsdInputToCents rejects garbage, negatives, and >2 decimal places', () => {
    expect(m.parseUsdInputToCents('abc')).toBeNull();
    expect(m.parseUsdInputToCents('-5')).toBeNull();
    expect(m.parseUsdInputToCents('5.999')).toBeNull();
    expect(m.parseUsdInputToCents('')).toBeNull();
    expect(m.parseUsdInputToCents(null)).toBeNull();
  });

  it('a round trip through cents never drifts (repeated +/- $10 stays exact)', () => {
    let cents = m.clampCeilingCents(9100);
    for (let i = 0; i < 37; i++) cents = m.clampCeilingCents(cents + 1000);
    // 9100 + 37*1000 = 46100 exactly — a float-dollar accumulation of 37 additions
    // of 10.00 would risk cent-level drift; integer cents can't.
    expect(cents).toBe(46100);
    expect(m.centsToUsdInputStr(cents)).toBe('461.00');
  });

  it('clampCeilingCents enforces [1, 100000] and rounds non-integers', () => {
    expect(m.clampCeilingCents(0)).toBe(1);
    expect(m.clampCeilingCents(-500)).toBe(1);
    expect(m.clampCeilingCents(100001)).toBe(100000);
    expect(m.clampCeilingCents(175.6)).toBe(176);
  });
  it('clampCeilingCents never returns NaN/undefined for bad input (defaults to the floor)', () => {
    expect(m.clampCeilingCents(NaN)).toBe(1);
    expect(m.clampCeilingCents(undefined)).toBe(1);
  });
});

describe('buildCeilingRequestBody — the exact outgoing wire shape', () => {
  it('includes exactly requestId/targetCeilingCents/expectedEpochKey/expectedCeilingCents', () => {
    const m = loadCeilingModule();
    const body = m.buildCeilingRequestBody('cca-abc', 17500, '7', 15000);
    expect(body).toEqual({
      requestId: 'cca-abc',
      targetCeilingCents: 17500,
      expectedEpochKey: '7',
      expectedCeilingCents: 15000,
    });
    expect(Object.keys(body).sort()).toEqual(
      ['expectedCeilingCents', 'expectedEpochKey', 'requestId', 'targetCeilingCents'].sort(),
    );
  });
});

describe('resolveCeilingRequestId — retry reuses the same requestId', () => {
  let m: CeilingModule;
  beforeEach(() => {
    m = loadCeilingModule();
  });

  it('mints a fresh id when there is no prior in-flight request', () => {
    const id = m.resolveCeilingRequestId(undefined, 17500, '7', 15000);
    expect(id).toMatch(/^cca-/);
  });

  it('reuses the SAME id when retrying the identical action', () => {
    const first = m.resolveCeilingRequestId(undefined, 17500, '7', 15000);
    const prior = { requestId: first, targetCeilingCents: 17500, expectedEpochKey: '7', expectedCeilingCents: 15000 };
    const second = m.resolveCeilingRequestId(prior, 17500, '7', 15000);
    expect(second).toBe(first);
  });

  it('mints a NEW id when the target value changed (a different logical action)', () => {
    const first = m.resolveCeilingRequestId(undefined, 17500, '7', 15000);
    const prior = { requestId: first, targetCeilingCents: 17500, expectedEpochKey: '7', expectedCeilingCents: 15000 };
    const second = m.resolveCeilingRequestId(prior, 18000, '7', 15000);
    expect(second).not.toBe(first);
  });

  it('mints a NEW id when the expected epoch/ceiling changed (view refreshed since)', () => {
    const first = m.resolveCeilingRequestId(undefined, 17500, '7', 15000);
    const prior = { requestId: first, targetCeilingCents: 17500, expectedEpochKey: '7', expectedCeilingCents: 15000 };
    expect(m.resolveCeilingRequestId(prior, 17500, '8', 15000)).not.toBe(first);
    expect(m.resolveCeilingRequestId(prior, 17500, '7', 15500)).not.toBe(first);
  });
});

describe('reconcileCeilingPendingState — terminal outcomes clear pending state, non-terminal ones do not', () => {
  let m: CeilingModule;
  beforeEach(() => {
    m = loadCeilingModule();
    m.ceilingPending.add('sess-1');
    m.ceilingInFlight.set('sess-1', {
      requestId: 'cca-mine',
      targetCeilingCents: 17500,
      expectedEpochKey: '7',
      expectedCeilingCents: 15000,
    });
    m.ceilingDrafts.set('sess-1', 17500);
  });

  it('a conflict response clears pending/in-flight/draft — refresh, not silent reapply', () => {
    m.reconcileCeilingPendingState([
      { session_id: 'sess-1', latestCostAdjustment: { id: 'cca-mine', state: 'conflict', targetCeilingCents: 17500, requestedAt: 't' } },
    ]);
    expect(m.ceilingPending.has('sess-1')).toBe(false);
    expect(m.ceilingInFlight.has('sess-1')).toBe(false);
    expect(m.ceilingDrafts.has('sess-1')).toBe(false);
  });

  it('an applied response clears pending/in-flight/draft — render the server value, not the stale draft', () => {
    m.reconcileCeilingPendingState([
      { session_id: 'sess-1', latestCostAdjustment: { id: 'cca-mine', state: 'applied', targetCeilingCents: 17500, requestedAt: 't' } },
    ]);
    expect(m.ceilingPending.has('sess-1')).toBe(false);
    expect(m.ceilingDrafts.has('sess-1')).toBe(false);
  });

  it('a rejected response also clears pending/in-flight/draft', () => {
    m.reconcileCeilingPendingState([
      { session_id: 'sess-1', latestCostAdjustment: { id: 'cca-mine', state: 'rejected', targetCeilingCents: 17500, requestedAt: 't' } },
    ]);
    expect(m.ceilingPending.has('sess-1')).toBe(false);
  });

  it('leaves pending state alone while still pending/enqueued (not yet terminal)', () => {
    m.reconcileCeilingPendingState([
      { session_id: 'sess-1', latestCostAdjustment: { id: 'cca-mine', state: 'enqueued', targetCeilingCents: 17500, requestedAt: 't' } },
    ]);
    expect(m.ceilingPending.has('sess-1')).toBe(true);
    expect(m.ceilingInFlight.has('sess-1')).toBe(true);
  });

  it('does NOT clear on a DIFFERENT admin/card terminal adjustment for the same session (id mismatch)', () => {
    // A concurrent adjustment (different requestId) reaching a terminal state
    // must not be mistaken for the outcome of THIS browser's own request.
    m.reconcileCeilingPendingState([
      { session_id: 'sess-1', latestCostAdjustment: { id: 'cca-someone-else', state: 'applied', targetCeilingCents: 9000, requestedAt: 't' } },
    ]);
    expect(m.ceilingPending.has('sess-1')).toBe(true);
  });

  it('leaves pending state alone when the session is simply absent from this page of results', () => {
    m.reconcileCeilingPendingState([{ session_id: 'sess-other', latestCostAdjustment: null }]);
    expect(m.ceilingPending.has('sess-1')).toBe(true);
  });
});
