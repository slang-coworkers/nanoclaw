/**
 * Rendering contract for the review-cycles v2 panel (reviewRoundsHtml and the
 * reviewCyclesV2* helpers in dashboard/public/app.js) against the producer's
 * schema-3 sample document (dashboard/fixtures/review-rounds-v2-sample.json).
 *
 * The v1 chart plotted a MEAN with no minimum-N guard, which is how one PR
 * became a "spike to 7". The properties pinned here are the ones the operator
 * spec calls out and a renderer could quietly regress:
 *
 *   median is the headline, mean/p90 only in the hover;
 *   prs < 5 is a hollow marker with an "n=<k>" label, never a solid point;
 *   both indices (rounds AND comments) render, bot vs human;
 *   the axis defaults to activity week and can switch to merge week;
 *   the repo selector lists all seven repos plus "all";
 *   the ">5 rounds" table lists the right PRs with classification counts and
 *   fills the "why" slot from the mining index when present;
 *   a schema-2 (v1) snapshot still renders the legacy panel.
 *
 * app.js is a browser script with no module exports, so the functions are
 * extracted from source and evaluated. It tests the SHIPPED code and fails
 * loudly if a function is renamed.
 */
import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = fs.readFileSync(path.join(HERE, 'public', 'app.js'), 'utf-8');
const SAMPLE = JSON.parse(fs.readFileSync(path.join(HERE, 'fixtures', 'review-rounds-v2-sample.json'), 'utf-8'));

function extractFunction(name: string): string {
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

const NAMES = [
  'reviewRoundsHtml',
  'reviewRoundsTrendSvg',
  'reviewCyclesV2Html',
  'reviewCyclesV2TrendSvg',
  'reviewCyclesV2LongTable',
  'reviewWhyIndex',
];

interface Panel {
  reviewRoundsHtml: (rr: unknown) => string;
  reviewCyclesV2Html: (rr: unknown, state: unknown, why: Map<string, string>, freshness?: string) => string;
  reviewCyclesV2LongTable: (perPR: unknown, repo: string, why: Map<string, string>, thr?: number) => string;
  reviewWhyIndex: (json: unknown) => Map<string, string>;
  state: { axis: string; repo: string };
  why: Map<string, string>;
}

function loadPanel(): Panel {
  const src = NAMES.map(extractFunction).join('\n');
  const state = { axis: 'activity', repo: 'all' };
  const why = new Map<string, string>();
  const factory = new Function(
    'esc',
    'reviewCyclesV2State',
    'reviewCyclesV2Why',
    'REVIEW_CYCLES_MIN_N',
    'REVIEW_CYCLES_LONG_ROUNDS',
    `${src}; return { reviewRoundsHtml, reviewCyclesV2Html, reviewCyclesV2LongTable, reviewWhyIndex };`,
  ) as (...args: unknown[]) => Omit<Panel, 'state' | 'why'>;
  const esc = (s: unknown) =>
    String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  return { ...factory(esc, state, why, 5, 5), state, why };
}

const clone = <T>(o: T): T => JSON.parse(JSON.stringify(o));

describe('review cycles v2 panel (schema 3)', () => {
  it('renders both indices as separate bot/human charts with the median as headline', () => {
    const p = loadPanel();
    const html = p.reviewRoundsHtml(SAMPLE);
    expect(html).toContain('data-review-cycles-v2');
    // No arithmetic leak into the markup, on any of the sample's null-median weeks.
    expect(html).not.toContain('NaN');
    expect(html).not.toContain('undefined');
    expect(html).toContain('Median human review rounds / PR');
    expect(html).toContain('Median human review comments / PR');
    // Two series colours in each chart.
    expect((html.match(/#d29922/g) || []).length).toBeGreaterThan(2);
    expect((html.match(/#58a6ff/g) || []).length).toBeGreaterThan(2);
    // Totals headline: bot median 1 round / 0 comments over 21 PRs (sample totals).
    expect(html).toContain('median <b>1</b> rounds / <b>0</b> comments per PR (n=21)');
    // Mean lives in the hover, not the headline.
    expect(html).toMatch(/title="bot PRs \(whole-PR, all states\): rounds mean 1\.2, p90 1/);
    // Never the v1 legacy chart.
    expect(html).not.toContain('Avg human review cycles / merged PR');
  });

  it('draws prs < 5 as a hollow marker labelled n=<k>, and prs >= 5 as a solid point', () => {
    const html = loadPanel().reviewRoundsHtml(SAMPLE);
    // 2026-08-31 activity week: bot prs = 4 (lowN) in the sample.
    expect(html).toContain('data-low-n="4"');
    expect(html).toMatch(/<circle[^>]*fill="var\(--bg-card,#0d1117\)"[^>]*stroke="#d29922"/);
    expect(html).toContain('>n=4</text>');
    // 2026-08-17 has 12 bot PRs: a solid marker, with N printed but no "n=" prefix.
    expect(html).toMatch(/<circle[^>]*r="3" fill="#d29922"/);
    expect(html).toContain('>12</text>');
    expect(html).not.toContain('>n=12<');
    // The hover carries the guard wording.
    expect(html).toContain('LOW N (fewer than 5 PRs)');
  });

  it('defaults to the activity-week axis and switches to merge week from state', () => {
    const p = loadPanel();
    const act = p.reviewRoundsHtml(SAMPLE);
    expect(act).toMatch(/data-rc-axis="activity"[^>]*background:var\(--accent,#76b900\)/);
    expect(act).toContain('N = PRs touched that week');
    // Activity weeks reach back to July (the sample's long design review).
    expect(act).toContain('>07-06</text>');

    p.state.axis = 'merge';
    const merge = p.reviewRoundsHtml(SAMPLE);
    expect(merge).toMatch(/data-rc-axis="merge"[^>]*background:var\(--accent,#76b900\)/);
    expect(merge).toContain('Merge week (legacy population)');
    expect(merge).toContain('small numbers = N PRs merged that week');
    expect(merge).not.toContain('>07-06</text>');
    expect(merge).toContain('>08-17</text>');
  });

  it('lists all seven repos plus "all" and scopes the series through perRepo', () => {
    const p = loadPanel();
    const html = p.reviewRoundsHtml(SAMPLE);
    const options = html.match(/<option value="[^"]*"/g) || [];
    expect(options).toHaveLength(8);
    expect(html).toContain('<option value="all" selected>all 7 repos</option>');
    for (const r of SAMPLE.window.repos) expect(html).toContain(`<option value="${r}"`);

    p.state.repo = 'shader-slang/slang-playground';
    const empty = p.reviewRoundsHtml(SAMPLE);
    expect(empty).toContain('shader-slang/slang-playground');
    expect(empty).toContain('No weeks to plot for this scope.');
    expect(empty).toContain('(n=0, low N)');

    p.state.repo = 'shader-slang/slang';
    const slang = p.reviewRoundsHtml(SAMPLE);
    expect(slang).toContain('· bot vs human authored · shader-slang/slang ·');
    expect(slang).toContain('(n=18)');
  });

  it('shows the auditable filter counters so removed automation is visible, not silent', () => {
    const html = loadPanel().reviewRoundsHtml(SAMPLE);
    // 18 board-sync notices; the bot's one reply on its own PR is self, not
    // automation, so removedAutomation is exactly the automation being audited.
    expect(html).toContain('Filtered out (all repos): <b>18</b> automation comments (18 board-sync notices');
    expect(html).toContain('<b>1</b> dispatch commands');
    expect(html).toContain('<b>1</b> self-comments');
    expect(html).toContain('top removed logins: jhelferty-nv 18)');
    expect(html).toContain('1 automation-authored PRs excluded from both classes.');
    expect(html).not.toContain('unknown, deleted author');
  });

  it('names unknown-authored PRs beside the automation-authored exclusion', () => {
    const snap = clone(SAMPLE);
    snap.totals.unknownAuthoredPrs = 2;
    const html = loadPanel().reviewRoundsHtml(snap);
    expect(html).toContain(
      '1 automation-authored PRs excluded from both classes (and 2 with an unknown, deleted author)',
    );
  });

  it('draws a partial week hollow even when N is large, and says why in the hover', () => {
    const snap = clone(SAMPLE);
    const row = snap.weeklyByActivity.find((r: { week: string }) => r.week === '2026-08-17');
    row.partial = true;
    row.partialReasons = ['in-progress'];
    const html = loadPanel().reviewRoundsHtml(snap);
    // 12 bot PRs, so not low N: hollow because partial, labelled with the plain N.
    expect(html).toMatch(/<circle[^>]*fill="var\(--bg-card,#0d1117\)"[^>]*stroke="#d29922"[^>]*data-partial="1"/);
    expect(html).toContain('>12</text>');
    expect(html).not.toContain('>n=12<');
    expect(html).toContain('PARTIAL WEEK (in-progress)');
    expect(html).toContain('or partial weeks');
    // The sample as shipped has no partial week, so no marker carries the flag.
    expect(loadPanel().reviewRoundsHtml(SAMPLE)).not.toContain('data-partial');
  });

  it('">5 rounds" table: empty state, then the right PRs with classification counts and the why slot', () => {
    const p = loadPanel();
    const none = p.reviewRoundsHtml(SAMPLE);
    expect(none).toContain('PRs with &gt; 5 rounds');
    expect(none).toContain('No PR drew more than 5 rounds in the window.');

    const snap = clone(SAMPLE);
    snap.perPR[0].rounds = 7; // slang #12186, three reviewers, classification CR 4
    snap.perPR[1].rounds = 6;
    snap.perPR[1].repo = 'shader-slang/slangpy';
    snap.perPR[1].number = 999;
    snap.perPR[1].url = 'https://github.com/shader-slang/slangpy/pull/999';
    snap.perPR[1].title = 'Title with <img src=x> in it';
    const html = p.reviewRoundsHtml(snap);
    expect(html).toContain('PRs with &gt; 5 rounds <span style="font-weight:400;color:var(--text-muted)">(2)');
    expect(html).toContain('href="https://github.com/shader-slang/slang/pull/12186"');
    expect(html).toContain('slang #12186');
    expect(html).toContain('csyonghe, jkwak-work, pdeayton-nv');
    expect(html).toContain('Q 1 · CR 4 · nit 0 · ack 1 · proc 0 · other 0');
    expect(html).toContain('why it took this long');
    expect(html).toContain('no mining summary yet');
    // Ordered by rounds desc: #12186 (7) before slangpy #999 (6).
    expect(html.indexOf('slang #12186')).toBeLessThan(html.indexOf('slangpy #999'));
    // Titles are escaped.
    expect(html).not.toContain('<img src=x>');
    expect(html).toContain('&lt;img src=x&gt;');

    // Repo scoping applies to the table too.
    p.state.repo = 'shader-slang/slangpy';
    const scoped = p.reviewRoundsHtml(snap);
    expect(scoped).toContain('slangpy #999');
    expect(scoped).not.toContain('slang #12186');

    // The mining index fills the slot for the PR it knows about.
    p.state.repo = 'all';
    p.why.set(
      'shader-slang/slang#12186',
      'Six-week design review; kind-dependent SPIR-V representation debated across 21 threads.',
    );
    const withWhy = p.reviewRoundsHtml(snap);
    expect(withWhy).toContain('<span data-rc-why>Six-week design review;');
    expect(withWhy).toContain('data-rc-why-empty'); // #999 still has none
  });

  it('reviewWhyIndex accepts the plausible mining shapes and ignores garbage', () => {
    const { reviewWhyIndex } = loadPanel();
    const list = reviewWhyIndex({
      items: [
        { repo: 'shader-slang/slang', number: 1, why: 'a' },
        { repo: 'shader-slang/slang', pr: 2, summary: 'b' },
        { repo: 'shader-slang/slang', number: 3 },
      ],
    });
    expect(list.get('shader-slang/slang#1')).toBe('a');
    expect(list.get('shader-slang/slang#2')).toBe('b');
    expect(list.has('shader-slang/slang#3')).toBe(false);
    const keyed = reviewWhyIndex({ 'shader-slang/slangpy#7': 'c', 'shader-slang/slang': { '8': { text: 'd' } } });
    expect(keyed.get('shader-slang/slangpy#7')).toBe('c');
    expect(keyed.get('shader-slang/slang#8')).toBe('d');
    expect(reviewWhyIndex(null).size).toBe(0);
    expect(reviewWhyIndex('nope').size).toBe(0);
    expect(reviewWhyIndex({ generatedAt: 'x' }).size).toBe(0);
  });

  it('renders the incomplete note, never numbers, when the producer failed closed', () => {
    const html = loadPanel().reviewRoundsHtml({
      schema: 3,
      complete: false,
      errors: [{ what: 'graphql', detail: 'rate limited' }],
    });
    expect(html).toContain('Collection incomplete');
    expect(html).toContain('graphql: rate limited');
    expect(html).not.toContain('data-review-cycles-v2');
  });

  it('still renders the legacy panel for a schema-2 (v1) snapshot', () => {
    const v1 = {
      schema: 2,
      complete: true,
      since: '2026-04-10',
      weekly: [
        {
          week: '2026-08-24',
          botAuthored: { prs: 16, avgCycles: 4.19, avgThreads: 1.62, avgIssueComments: 2.56, avgRounds: 0.12 },
          humanAuthored: { prs: 18, avgCycles: 0.56, avgThreads: 0.3, avgIssueComments: 0.26, avgRounds: 0 },
        },
      ],
      totals: {
        botAuthored: { prs: 16, avgCycles: 4.19, avgRounds: 0.12 },
        humanAuthored: { prs: 18, avgCycles: 0.56 },
      },
    };
    const html = loadPanel().reviewRoundsHtml(v1);
    expect(html).toContain('Avg human review cycles / merged PR');
    expect(html).not.toContain('data-review-cycles-v2');
  });

  it('returns empty for a null payload rather than throwing', () => {
    expect(loadPanel().reviewRoundsHtml(null)).toBe('');
  });
});
