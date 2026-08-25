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
  status?: string;
  container_status?: string;
  last_active?: string;
  ghNumber?: number;
  ghRepo?: string;
}

interface FakeEl {
  innerHTML: string;
}

function buildRenderer(): {
  render: (adminState: { sessions: FakeSession[] }, sessionsView: Record<string, unknown>) => string;
} {
  // The four render-layer functions, all top-level declarations in app.js
  // that call each other by plain identifier (hoisting makes declaration
  // order irrelevant) — concatenated into one function body so they share
  // a scope, same as they do in the browser.
  const combined = [
    extractFn('esc'),
    extractFn('escAttr'),
    extractFn('fmtNum'),
    extractFn('fmtUsd'),
    extractFn('sessionGroupOptions'),
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
