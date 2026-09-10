/**
 * Rendering contracts for the three small quality-panel fixes from the
 * 2026-09-09 prod audit (dashboard/public/app.js):
 *
 *   funnelWeeklyTrendSvg     the WIN trend legend said "merged ÷ actionable" while
 *                            the producer plots merged ÷ bot PRs authored; the
 *                            label and tooltip must say what is plotted.
 *   funnelApproverWeeklySvg  weeks 2026-08-31 and 2026-09-07 carry the policy
 *                            fallback annotation; a chart rendered without
 *                            annotations is byte-for-byte the old chart.
 *   verityPolicyLineHtml     the policy the latest ledger row ran under, with
 *                            the server's verdict spelled out (never a silent ok).
 *   unitCostHtml             weekly spend shown beside $/PR, still never "$0"
 *                            for a week without coverage.
 *
 * app.js is a browser script with no module exports, so functions are extracted
 * from source and evaluated (the same idiom as the neighbouring panel tests).
 */
import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = fs.readFileSync(path.join(HERE, 'public', 'app.js'), 'utf-8');

const esc = (s: unknown) =>
  String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

function balanced(start: number, open: string, close: string): number {
  let depth = 0;
  for (let j = APP.indexOf(open, start); j < APP.length; j++) {
    if (APP[j] === open) depth++;
    else if (APP[j] === close) {
      depth--;
      if (depth === 0) return j + 1;
    }
  }
  return -1;
}

function extractFunction(name: string): string {
  const start = APP.indexOf(`function ${name}(`);
  expect(start, `${name} must exist in app.js`).toBeGreaterThan(-1);
  const end = balanced(start, '{', '}');
  expect(end, `${name} must be brace-balanced`).toBeGreaterThan(-1);
  return APP.slice(start, end);
}

function extractConstArray(name: string): string {
  const start = APP.indexOf(`const ${name} = [`);
  expect(start, `${name} must exist in app.js`).toBeGreaterThan(-1);
  const end = balanced(start, '[', ']');
  expect(end, `${name} must be bracket-balanced`).toBeGreaterThan(-1);
  return APP.slice(start, end) + ';';
}

describe('funnelWeeklyTrendSvg: the label says what is plotted', () => {
  const render = new Function('esc', `${extractFunction('funnelWeeklyTrendSvg')}; return funnelWeeklyTrendSvg;`)(
    esc,
  ) as (weekly: unknown) => string;
  const week = (o: Record<string, unknown> = {}) => ({
    week: '2026-08-24',
    filed: 40,
    actionable: 39,
    merged: 3,
    botPr: 10,
    winRate: 0.3,
    rollingWinRate: 0.28,
    ...o,
  });

  it('names bot PRs authored as the denominator, not actionable issues', () => {
    const html = render([week(), week({ week: '2026-08-31' })]);
    expect(html).toContain('merged ÷ bot PRs authored');
    expect(html).not.toContain('merged ÷ actionable');
    // The raw-dot tooltip shows the same ratio the producer computed (3/10), not 3/39.
    expect(html).toContain('(3/10 bot PRs)');
    expect(html).not.toContain('3/39');
  });

  it('falls back to the actionable count, labelled, for a snapshot without botPr', () => {
    const w = week();
    delete (w as Record<string, unknown>).botPr;
    expect(render([w])).toContain('(3/39 actionable)');
  });
});

describe('funnelApproverWeeklySvg: week annotations', () => {
  const src = `${extractConstArray('VERITY_WEEK_ANNOTATIONS')}\n${extractFunction('funnelApproverWeeklySvg')}`;
  const { chart, annotations } = new Function(
    'esc',
    `${src}; return { chart: funnelApproverWeeklySvg, annotations: VERITY_WEEK_ANNOTATIONS };`,
  )(esc) as {
    chart: (w: unknown, l?: unknown, a?: unknown) => string;
    annotations: Array<{ week: string; note: string }>;
  };
  const week = (weekStart: string) => ({
    weekStart,
    total: 78,
    wouldApprove: 2,
    block: 0,
    abstain: 76,
    withHumanVerdict: 63,
    agreedApprove: 2,
    agreedBlock: 0,
    falseApprove: 0,
    falseBlock: 0,
    agreementPct: 3.2,
  });

  it('ships the two spec weeks with the policy-fallback note', () => {
    expect(annotations.map((a) => a.week)).toEqual(['2026-08-31', '2026-09-07']);
    for (const a of annotations) {
      expect(a.note).toBe(
        'policy fallback: bundled v0-shadow after the host move lost /ephemeral/approver-policy; v0-shadow-wide-r2 from 2026-09-09 requires CI green',
      );
    }
  });

  it('flags annotated weeks present in the series and spells the note out once for both', () => {
    const weeks = [week('2026-08-24'), week('2026-08-31'), week('2026-09-07')];
    const html = chart(weeks, [], annotations);
    expect((html.match(/⚑<title>/g) || []).length).toBe(2);
    expect(html).toContain('2026-08-31: policy fallback: bundled v0-shadow');
    expect(html).toContain('⚑ 2026-08-31, 2026-09-07: policy fallback');
    expect(html).toContain('requires CI green');
  });

  it('renders exactly the old chart when no annotations are passed, and no flag for absent weeks', () => {
    const weeks = [week('2026-08-24')];
    expect(chart(weeks, [], annotations)).toBe(chart(weeks, []));
    expect(chart(weeks, [], annotations)).not.toContain('⚑');
  });
});

describe('verityPolicyLineHtml', () => {
  const render = new Function(
    'esc',
    'formatTime',
    `${extractFunction('verityPolicyLineHtml')}; return verityPolicyLineHtml;`,
  )(esc, (v: string) => `T(${v})`) as (p: unknown) => string;
  const policy = (o: Record<string, unknown> = {}) => ({
    status: 'ok',
    reasons: [],
    latestDecision: {
      repo: 'slang-coworkers/nanoclaw',
      prNumber: 1500,
      policyVersion: 'v0-shadow-wide-r2',
      decidedAt: '2026-09-09T10:25:22Z',
    },
    expectedVersion: 'v0-shadow-wide-r2',
    mountRejections: { count: 0, windowHours: 24 },
    ...o,
  });

  it('names the version in effect, the policy of record and the rejection count', () => {
    const html = render(policy());
    expect(html).toContain('Approver policy OK');
    expect(html).toContain('<b>v0-shadow-wide-r2</b>');
    expect(html).toContain('T(2026-09-09T10:25:22Z)');
    expect(html).toContain('nanoclaw #1500');
    expect(html).toContain('policy of record <b>v0-shadow-wide-r2</b>');
    expect(html).toContain('0 mount rejections in 24 h');
  });

  it('spells out the warn reasons in amber', () => {
    const html = render(
      policy({
        status: 'warn',
        reasons: ['latest decision ran under the bundled "v0-shadow" policy'],
        latestDecision: {
          repo: 'shader-slang/slang',
          prNumber: 12844,
          policyVersion: 'v0-shadow',
          decidedAt: '2026-08-31T16:16:24Z',
        },
        mountRejections: { count: 209, windowHours: 24 },
      }),
    );
    expect(html).toContain('Approver policy WARN');
    expect(html).toContain('<b>v0-shadow</b>');
    expect(html).toContain('209 mount rejections in 24 h');
    expect(html).toContain('bundled &quot;v0-shadow&quot;'.replace(/&quot;/g, '"'));
    expect(html).toContain('var(--warn,#d29922)');
  });

  it('is unknown in words when there is no decision, and empty for a null payload', () => {
    const html = render(
      policy({
        status: 'unknown',
        latestDecision: null,
        expectedVersion: null,
        reasons: ['no approval_decisions row to judge'],
      }),
    );
    expect(html).toContain('Approver policy UNKNOWN');
    expect(html).toContain('no decision recorded');
    expect(html).toContain('no policy of record in this checkout');
    expect(render(null)).toBe('');
  });
});

describe('unitCostHtml: spend beside $/PR', () => {
  const render = new Function('esc', `${extractFunction('unitCostHtml')}; return unitCostHtml;`)(esc) as (
    uc: unknown,
  ) => string;
  const week = (o: Record<string, unknown> = {}) => ({
    week: '2026-08-17',
    cost: 5688,
    prs: 50,
    costPerPr: 114,
    hasCost: true,
    ...o,
  });

  it('shows the weekly spend next to the quotient and the denominator', () => {
    const html = render({ weeks: [week()], groupsMissing: [], unavailable: null });
    expect(html).toContain('$114');
    expect(html).toContain('title="weekly spend, triager + fixer + reviewer">$5,688<');
    expect(html).toContain('50 PRs');
    expect(html).toContain('Spend $5,688 over 1 week with cost data');
    expect(html).toContain('columns: $/PR &middot; weekly spend &middot; PRs opened');
  });

  it('shows real spend for a week with no PR, and a dash (never $0) for a week without coverage', () => {
    const html = render({
      weeks: [
        week({ week: '2026-08-10', prs: 0, costPerPr: null, cost: 120 }),
        week({ week: '2026-08-03', hasCost: false, cost: 0, prs: 0, costPerPr: null }),
      ],
      groupsMissing: [],
      unavailable: null,
    });
    expect(html).toContain('no PR opened');
    expect(html).toContain('>$120<');
    expect(html).toContain('no data');
    expect(html).not.toMatch(/\$0\b/);
    expect(html).toContain('Spend $120 over 1 week with cost data');
  });
});

describe('approverPolicyInfraRows: the infra table row set', () => {
  const render = new Function(
    'esc',
    'formatTime',
    `${extractFunction('approverPolicyInfraRows')}; return approverPolicyInfraRows;`,
  )(esc, (v: string) => `T(${v})`) as (p: unknown) => string;

  it('renders a visible "not reported" row for a server without the check', () => {
    const html = render(undefined);
    expect(html).toContain('not reported by this server');
    expect(html).toContain('admin-chip stopped');
  });

  it('flags the bundled fallback, the mismatch and recent rejections as warnings', () => {
    const html = render({
      status: 'warn',
      reasons: ['latest decision ran under the bundled "v0-shadow" policy', '3 "Additional mount REJECTED" lines'],
      latestDecision: {
        repo: 'shader-slang/slang',
        prNumber: 12844,
        policyVersion: 'v0-shadow',
        decidedAt: '2026-08-31T16:16:24Z',
      },
      expectedVersion: 'v0-shadow-wide-r2',
      expectedSource: 'ops/slang-coworkers-prod/approver-policy/APPROVAL_POLICY.json',
      bundledVersion: 'v0-shadow',
      mountRejections: {
        count: 3,
        windowHours: 24,
        files: [
          { file: 'nanoclaw.log', count: 0, scanned: true, truncated: false },
          { file: 'nanoclaw.error.log', count: 3, scanned: true, truncated: true },
        ],
      },
      checkedAt: '2026-09-09T10:00:00Z',
    });
    expect(html).toContain('bundled fallback');
    expect(html).toContain('<code>v0-shadow</code>');
    expect(html).toContain('slang #12844');
    expect(html).toContain('<code>v0-shadow-wide-r2</code>');
    expect(html).toContain('ops/slang-coworkers-prod/approver-policy/APPROVAL_POLICY.json');
    expect(html).toContain('nanoclaw.error.log 3 (tail)');
    expect(html).toContain('>WARN<');
    expect(html).toContain('3 "Additional mount REJECTED" lines');
    expect(html).toContain('T(2026-09-09T10:00:00Z)');
  });

  it('is all OK when the versions match and nothing was rejected', () => {
    const html = render({
      status: 'ok',
      reasons: [],
      latestDecision: {
        repo: 'slang-coworkers/nanoclaw',
        prNumber: 1500,
        policyVersion: 'v0-shadow-wide-r2',
        decidedAt: '2026-09-09T10:25:22Z',
      },
      expectedVersion: 'v0-shadow-wide-r2',
      expectedSource: 'ops/slang-coworkers-prod/approver-policy/APPROVAL_POLICY.json',
      bundledVersion: 'v0-shadow',
      mountRejections: { count: 0, windowHours: 24, files: [] },
      checkedAt: '2026-09-09T10:30:00Z',
    });
    expect(html).not.toContain('bundled fallback');
    expect(html).not.toContain('mismatch');
    expect(html).toContain('>OK<');
    expect((html.match(/admin-chip active/g) || []).length).toBe(4);
  });

  it('reports unknown, not ok, when there is no ledger row and no policy of record', () => {
    const html = render({
      status: 'unknown',
      reasons: ['no approval_decisions row to judge'],
      latestDecision: null,
      expectedVersion: null,
      expectedSource: null,
      bundledVersion: 'v0-shadow',
      mountRejections: { count: 0, windowHours: 24, files: [] },
      checkedAt: '2026-09-09T10:30:00Z',
    });
    expect(html).toContain('no approval_decisions row');
    expect(html).toContain('not in this checkout');
    expect(html).toContain('>UNKNOWN<');
    expect(html).toContain('>unknown<');
  });
});
