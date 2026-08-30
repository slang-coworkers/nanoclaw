/**
 * End-to-end rendering contract for the Sessions admin table
 * (dashboard/public/app.js — renderAdminSessions), added alongside the
 * coworker filter dropdown (sessionGroupOptions).
 *
 * sessionGroupOptions has its own focused unit test (session-group-options
 * .test.ts) for the dedup/sort logic; this file drives the FULL render
 * function against a seeded adminState — the actual markup a browser would
 * get via innerHTML — so a mistake in the string-concatenation (a stray
 * quote, a wrong data-attribute name, filtering applied in the wrong order)
 * shows up as a failing assertion here rather than only in the browser.
 *
 * app.js is a browser script with no module exports, so the functions under
 * test are extracted from source and evaluated together in one scope (they
 * call each other by plain identifier, same as in the browser). Crude, but
 * it tests the SHIPPED code rather than a copy.
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

interface FakeSession {
  session_id: string;
  group_folder: string;
  group_name?: string;
  cost?: number;
  // Provider split of `cost` (issue #1327) — see renderCostCell in app.js.
  claudeUsd?: number;
  codexUsd?: number;
  costUnpriced?: boolean;
  status?: string;
  container_status?: string;
  last_active?: string;
  ghNumber?: number;
  ghRepo?: string;
  // dash-1 set-ceiling-v2 fields (see session-cost-caps.ts buildSessionCostFields).
  costStatus?: string;
  costSpent?: number;
  // Total lifetime spend — the pill's spent number (dash-display). See renderCostCapCell.
  costLifetime?: number;
  costCeiling?: number;
  costCeilingCents?: number;
  costImmortal?: boolean;
  costWindow?: string;
  costP99?: number;
  costControlVersion?: number;
  latestCostAdjustment?: { id: string; state: string; targetCeilingCents: number; requestedAt: string } | null;
}

interface FakeEl {
  innerHTML: string;
}

function buildRenderer(): {
  render: (adminState: { sessions: FakeSession[] }, sessionsView: Record<string, unknown>) => string;
} {
  // The render-layer functions, all top-level declarations in app.js that
  // call each other by plain identifier (hoisting makes declaration order
  // irrelevant) — concatenated into one function body so they share a scope,
  // same as they do in the browser. renderCostCapCell now also calls
  // renderCostCeilingControl (dash-1 set-ceiling-v2), which in turn reaches
  // for the module-scope ceilingDrafts/ceilingPending state — declared fresh
  // (empty) here rather than extracted, since these tests don't exercise any
  // in-flight/drafted control state.
  const combined = [
    'const ceilingDrafts = new Map(); const ceilingInFlight = new Map(); const ceilingPending = new Set();',
    'const CEILING_MIN_CENTS = 1; const CEILING_MAX_CENTS = 100000; const CEILING_STEP_CENTS = 1000;',
    extractFn('esc'),
    extractFn('escAttr'),
    extractFn('fmtNum'),
    extractFn('fmtUsd'),
    extractFn('sessionGroupOptions'),
    extractFn('centsToUsdInputStr'),
    extractFn('clampCeilingCents'),
    extractFn('renderCostCeilingControl'),
    extractFn('renderCostCell'),
    extractFn('renderCostCapCell'),
    extractFn('renderGithubOriginCell'),
    extractFn('renderAdminSessions'),
  ].join('\n');

  // renderAdminSessions also reaches for document.getElementById(...), and
  // for two session-id-cell helpers unrelated to the coworker filter
  // (lookupNanoSessById / isA2aSession) — stubbed rather than extracted:
  // lookupNanoSessById depends on a module-level `cachedSessions` cache that
  // has nothing to do with this render, and "not yet loaded" (-> null) is
  // its own documented fallback state.
  const factory = new Function(
    'adminState',
    'sessionsView',
    'document',
    'lookupNanoSessById',
    'isA2aSession',
    `${combined}\nreturn renderAdminSessions;`,
  ) as (
    adminState: unknown,
    sessionsView: unknown,
    document: unknown,
    lookupNanoSessById: unknown,
    isA2aSession: unknown,
  ) => () => void;

  return {
    render(adminState, sessionsView) {
      const el: FakeEl = { innerHTML: '' };
      const fakeDocument = { getElementById: (id: string) => (id === 'admin-sessions-content' ? el : null) };
      const renderAdminSessions = factory(
        adminState,
        sessionsView,
        fakeDocument,
        () => null,
        () => false,
      );
      renderAdminSessions();
      return el.innerHTML;
    },
  };
}

function session(over: Partial<FakeSession> & Pick<FakeSession, 'session_id' | 'group_folder'>): FakeSession {
  return { cost: 1, status: 'active', container_status: 'running', last_active: '2026-08-25T00:00:00Z', ...over };
}

describe('renderAdminSessions — coworker filter dropdown', () => {
  const { render } = buildRenderer();
  let adminState: { sessions: FakeSession[] };
  let sessionsView: Record<string, unknown>;

  beforeEach(() => {
    adminState = {
      sessions: [
        session({ session_id: 's-fixer-1', group_folder: 'ag-fixer', group_name: 'Slang Fixer', cost: 4 }),
        session({ session_id: 's-fixer-2', group_folder: 'ag-fixer', group_name: 'Slang Fixer', cost: 2 }),
        session({ session_id: 's-reviewer-1', group_folder: 'ag-reviewer', group_name: 'Slang Reviewer', cost: 9 }),
        session({ session_id: 's-orch-1', group_folder: 'ag-orch', group_name: 'Orchestrator', cost: 1 }),
      ],
    };
    sessionsView = { period: '30d', sort: 'cost', filter: 'all', groupFilter: 'all', unavailable: null };
  });

  it('renders a <select> with "All coworkers" plus one option per distinct group', () => {
    const html = render(adminState, sessionsView);
    expect(html).toContain('data-sessions-group-filter');
    expect(html).toContain('<option value="all" selected>All coworkers</option>');
    expect(html).toContain('<option value="ag-fixer">Slang Fixer</option>');
    expect(html).toContain('<option value="ag-reviewer">Slang Reviewer</option>');
    expect(html).toContain('<option value="ag-orch">Orchestrator</option>');
    // Table shows every session when unfiltered.
    for (const id of ['s-fixer-1', 's-fixer-2', 's-reviewer-1', 's-orch-1']) expect(html).toContain(id);
  });

  it('omits the dropdown entirely when only one coworker exists (nothing to filter)', () => {
    adminState.sessions = adminState.sessions.filter((s) => s.group_folder === 'ag-fixer');
    const html = render(adminState, sessionsView);
    expect(html).not.toContain('data-sessions-group-filter');
  });

  it('selecting a coworker narrows the table to just that group', () => {
    sessionsView.groupFilter = 'ag-fixer';
    const html = render(adminState, sessionsView);
    expect(html).toContain('s-fixer-1');
    expect(html).toContain('s-fixer-2');
    expect(html).not.toContain('s-reviewer-1');
    expect(html).not.toContain('s-orch-1');
    // The selected option is marked, not "All coworkers".
    expect(html).toContain('<option value="ag-fixer" selected>Slang Fixer</option>');
    expect(html).toContain('<option value="all">All coworkers</option>');
  });

  it('re-scopes the cost-per-session percentile pills to the filtered coworker, not the fleet', () => {
    const allHtml = render(adminState, sessionsView);
    expect(allHtml).toContain('Cost per session — all coworkers (4 priced)');

    sessionsView.groupFilter = 'ag-fixer';
    const fixerHtml = render(adminState, sessionsView);
    expect(fixerHtml).toContain('Cost per session — Slang Fixer (2 priced)');
  });

  it('combines the coworker filter with the existing stopped-status filter', () => {
    adminState.sessions.push(session({ session_id: 's-fixer-3', group_folder: 'ag-fixer', group_name: 'Slang Fixer', cost: 3 }));
    // Manually flag one fixer session as stopped, the way costCap state would.
    (adminState.sessions.find((s) => s.session_id === 's-fixer-3') as FakeSession & { costStatus?: string }).costStatus =
      'stopped';
    sessionsView.groupFilter = 'ag-fixer';
    sessionsView.filter = 'stopped';
    const html = render(adminState, sessionsView);
    expect(html).toContain('s-fixer-3');
    expect(html).not.toContain('s-fixer-1');
    expect(html).not.toContain('s-reviewer-1');
  });

  it('shows a coworker-specific empty state when the filter matches nothing', () => {
    sessionsView.groupFilter = 'ag-fixer';
    sessionsView.filter = 'stopped'; // no fixer session is stopped in the default fixture
    const html = render(adminState, sessionsView);
    expect(html).toContain('No sessions match coworker "Slang Fixer"');
  });
});

// ── Live cost-ceiling control (dash-1 set-ceiling-v2) — one visually distinct
// rendering per state, per the test list: healthy, stopped, immortal,
// no-ceiling-configured, unsupported-runner-version (<2), pending-adjustment,
// applied, conflict. ──
describe('renderCostCapCell / renderCostCeilingControl — cost-ceiling states', () => {
  const { render } = buildRenderer();

  function renderOne(over: Partial<FakeSession>): string {
    const adminState = {
      sessions: [session({ session_id: 'sess-1', group_folder: 'ag-1', group_name: 'Coworker', ...over })],
    };
    const sessionsView = { period: '30d', sort: 'cost', filter: 'all', groupFilter: 'all', unavailable: null };
    return render(adminState, sessionsView);
  }

  it('healthy, protocol v2: shows the live +/-/Apply stepper, enabled', () => {
    const html = renderOne({ costStatus: 'ok', costSpent: 5, costCeiling: 150, costCeilingCents: 15000, costControlVersion: 2 });
    expect(html).toContain('data-action="cost-ceiling-step"');
    expect(html).toContain('data-action="cost-ceiling-apply"');
    expect(html).toContain('/ $150.00 ceiling');
    expect(html).not.toContain('not yet available');
    // Apply is present and NOT disabled.
    expect(html).toMatch(/data-action="cost-ceiling-apply"[^>]*>Apply</);
  });

  it('stopped: shows the red "stopped" pill with ceiling, the Continue button, AND the live stepper', () => {
    const html = renderOne({ costStatus: 'stopped', costSpent: 150, costCeiling: 150, costCeilingCents: 15000, costControlVersion: 2 });
    expect(html).toContain('stopped');
    expect(html).toContain('data-action="cost-override"');
    expect(html).toContain('data-decision="continue"');
    expect(html).toContain('data-action="cost-ceiling-apply"');
  });

  it('immortal: no stepper control at all, regardless of protocol version', () => {
    const html = renderOne({ costStatus: 'ok', costSpent: 5, costImmortal: true, costCeiling: 150, costCeilingCents: 15000, costControlVersion: 2 });
    expect(html).toContain('∞');
    expect(html).not.toContain('data-action="cost-ceiling-step"');
    expect(html).not.toContain('data-action="cost-ceiling-apply"');
    // Immortal never gets the Continue/Stop button either — pre-existing behavior, unaffected.
    expect(html).not.toContain('data-action="cost-override"');
  });

  it('no ceiling configured yet: control renders, with an explicit note instead of a stepper seeded from nothing', () => {
    const html = renderOne({ costStatus: 'ok', costSpent: 0, costControlVersion: 2 }); // costCeiling/costCeilingCents absent
    expect(html).toContain('no ceiling set yet');
    expect(html).toContain('data-action="cost-ceiling-apply"');
  });

  it('unsupported runner version (< protocol 2): "not yet available", no stepper — the rollout gate', () => {
    const html = renderOne({ costStatus: 'ok', costSpent: 5, costCeiling: 150, costCeilingCents: 15000, costControlVersion: 1 });
    expect(html).toContain('not yet available');
    expect(html).not.toContain('data-action="cost-ceiling-apply"');
    expect(html).not.toContain('data-action="cost-ceiling-step"');
  });

  it('unsupported runner version (absent costControlVersion): also "not yet available", not silently hidden', () => {
    const html = renderOne({ costStatus: 'ok', costSpent: 5, costCeiling: 150, costCeilingCents: 15000 });
    expect(html).toContain('not yet available');
  });

  it('pending-adjustment: stepper/Apply are disabled and read "Applying…"', () => {
    const html = renderOne({
      costStatus: 'ok',
      costSpent: 5,
      costCeiling: 150,
      costCeilingCents: 15000,
      costControlVersion: 2,
      latestCostAdjustment: { id: 'cca-1', state: 'enqueued', targetCeilingCents: 17500, requestedAt: 't' },
    });
    expect(html).toContain('Applying…');
    expect(html).toMatch(/data-action="cost-ceiling-apply"[^>]*disabled/);
    expect(html).toMatch(/data-action="cost-ceiling-step"[^>]*disabled/);
  });

  it('applied: a distinct green "applied" tag, control re-enabled', () => {
    const html = renderOne({
      costStatus: 'ok',
      costSpent: 175,
      costCeiling: 175,
      costCeilingCents: 17500,
      costControlVersion: 2,
      latestCostAdjustment: { id: 'cca-1', state: 'applied', targetCeilingCents: 17500, requestedAt: 't' },
    });
    expect(html).toContain('applied');
    expect(html).not.toContain('Applying…');
    expect(html).toMatch(/data-action="cost-ceiling-apply"[^>]*>Apply</); // not disabled, not stuck on "Applying…"
  });

  it('conflict: a distinct amber "conflict" tag, visually different from applied/pending', () => {
    const html = renderOne({
      costStatus: 'ok',
      costSpent: 5,
      costCeiling: 150,
      costCeilingCents: 15000,
      costControlVersion: 2,
      latestCostAdjustment: { id: 'cca-1', state: 'conflict', targetCeilingCents: 17500, requestedAt: 't' },
    });
    expect(html).toContain('conflict');
    expect(html).not.toContain('✓ applied');
    expect(html).not.toContain('Applying…');
  });

  it('healthy, stopped, immortal, no-ceiling, unsupported-version, pending, applied, and conflict are all pairwise distinct', () => {
    const variants = {
      healthy: renderOne({ costStatus: 'ok', costSpent: 5, costCeiling: 150, costCeilingCents: 15000, costControlVersion: 2 }),
      stopped: renderOne({ costStatus: 'stopped', costSpent: 150, costCeiling: 150, costCeilingCents: 15000, costControlVersion: 2 }),
      immortal: renderOne({ costStatus: 'ok', costSpent: 5, costImmortal: true, costCeiling: 150, costCeilingCents: 15000, costControlVersion: 2 }),
      noCeiling: renderOne({ costStatus: 'ok', costSpent: 0, costControlVersion: 2 }),
      unsupported: renderOne({ costStatus: 'ok', costSpent: 5, costCeiling: 150, costCeilingCents: 15000, costControlVersion: 1 }),
      pending: renderOne({
        costStatus: 'ok',
        costSpent: 5,
        costCeiling: 150,
        costCeilingCents: 15000,
        costControlVersion: 2,
        latestCostAdjustment: { id: 'cca-1', state: 'pending', targetCeilingCents: 17500, requestedAt: 't' },
      }),
      applied: renderOne({
        costStatus: 'ok',
        costSpent: 175,
        costCeiling: 175,
        costCeilingCents: 17500,
        costControlVersion: 2,
        latestCostAdjustment: { id: 'cca-1', state: 'applied', targetCeilingCents: 17500, requestedAt: 't' },
      }),
      conflict: renderOne({
        costStatus: 'ok',
        costSpent: 5,
        costCeiling: 150,
        costCeilingCents: 15000,
        costControlVersion: 2,
        latestCostAdjustment: { id: 'cca-1', state: 'conflict', targetCeilingCents: 17500, requestedAt: 't' },
      }),
    };
    const entries = Object.entries(variants);
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        expect(entries[i][1], `${entries[i][0]} vs ${entries[j][0]} must render differently`).not.toBe(entries[j][1]);
      }
    }
  });
});

// ── dash-display: the cost-cap pill's spent number (x in "x / y ceiling") is the
// session's TOTAL LIFETIME cost (s.costLifetime), NOT the runner's windowed
// enforcement counter (s.costSpent); the green COST column stays the SELECTED
// PERIOD total (s.cost). Fallback to costSpent when lifetime isn't scanned yet. ──
describe('renderCostCapCell — pill shows lifetime total, cost column shows period (dash-display)', () => {
  const { render } = buildRenderer();

  function renderOne(over: Partial<FakeSession>): string {
    const adminState = {
      sessions: [session({ session_id: 'sess-1', group_folder: 'ag-1', group_name: 'Coworker', ...over })],
    };
    const sessionsView = { period: '30d', sort: 'cost', filter: 'all', groupFilter: 'all', unavailable: null };
    return render(adminState, sessionsView);
  }

  it('(a) stopped pill shows lifetime-total / ceiling — the true money spent, not the windowed costSpent', () => {
    // costSpent (199.35) = runner's windowed enforcement counter; costLifetime
    // (347.59) = true all-time total. The pill must read $347.59 / $196.77.
    const html = renderOne({ costStatus: 'stopped', costSpent: 199.35, costLifetime: 347.59, costCeiling: 196.77 });
    expect(html).toContain('$347.59'); // x = lifetime total
    expect(html).toContain('/ $196.77 ceiling'); // y = ceiling
    expect(html).not.toContain('$199.35'); // NOT the windowed enforcement counter
    expect(html).toContain('stopped');
  });

  it('(a) healthy pill likewise shows the lifetime total, not costSpent', () => {
    const html = renderOne({ costStatus: 'ok', costSpent: 50, costLifetime: 320, costCeiling: 196.77 });
    expect(html).toContain('$320.00');
    expect(html).not.toContain('$50.00');
    expect(html).toContain('/ $196.77 ceiling');
  });

  it('(c) falls back to costSpent when costLifetime is absent (a live cap with no scanned cost yet)', () => {
    const html = renderOne({ costStatus: 'stopped', costSpent: 199.35, costCeiling: 196.77 }); // costLifetime undefined
    expect(html).toContain('$199.35');
    expect(html).toContain('/ $196.77 ceiling');
  });

  it('immortal (daily window): informational lifetime-total / ceiling /day, still no "stopped"', () => {
    const html = renderOne({
      costStatus: 'ok',
      costImmortal: true,
      costWindow: 'daily',
      costSpent: 40,
      costLifetime: 500,
      costCeiling: 196.77,
    });
    expect(html).toContain('$500.00');
    expect(html).toContain('/ $196.77 ceiling /day');
    expect(html).toContain('∞');
    // Not the red stopped pill (that label is `> stopped</span>`; the bare word
    // "stopped" also appears in the table's filter chip + header tooltip, so match
    // the pill fragment, not the word). Immortal also never gets a Continue/Stop.
    expect(html).not.toContain('stopped</span>');
    expect(html).not.toContain('data-action="cost-override"');
  });

  it('(b) the green COST column reflects the selected period (s.cost), independent of the lifetime pill', () => {
    // s.cost (12.34) is the period total the server scoped to ?period=; costLifetime
    // (999) is all-time. They are different fields and must render independently:
    // the cost column shows the period value, the pill shows the lifetime value.
    const html = renderOne({
      cost: 12.34,
      claudeUsd: 12.34,
      costStatus: 'stopped',
      costSpent: 5,
      costLifetime: 999,
      costCeiling: 196.77,
    });
    expect(html).toContain('$12.34'); // cost column = selected period
    expect(html).toContain('$999.00'); // pill = lifetime total
  });
});
