/**
 * Rendering contract for the weekly PR-approver (Verity) agreement chart
 * (funnelApproverWeeklySvg in dashboard/public/app.js).
 *
 * The chart exists to answer "is Verity improving week over week and safe to
 * take out of shadow mode?" — so the two properties worth pinning are the ones a
 * renderer could quietly get wrong:
 *
 *   absent field degrades to nothing   — an older snapshot has no approverWeekly;
 *                                         the chart must render '' , not throw.
 *   a no-verdict week is not a zero     — agreementPct === null must break the
 *                                         line, never plot a 0% (or a NaN).
 *
 * app.js is a browser script with no module exports, so the function is extracted
 * from source and evaluated — it tests the SHIPPED code, and fails loudly if the
 * function is renamed or removed.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = fs.readFileSync(path.join(HERE, 'public', 'app.js'), 'utf-8');

function loadChart(): (weekly: unknown) => string {
  const start = APP.indexOf('function funnelApproverWeeklySvg(');
  expect(start, 'funnelApproverWeeklySvg must exist in app.js').toBeGreaterThan(-1);
  // Balance braces from the function's opening brace to its close.
  const i = APP.indexOf('{', start);
  let depth = 0;
  let end = -1;
  for (let j = i; j < APP.length; j++) {
    if (APP[j] === '{') depth++;
    else if (APP[j] === '}') {
      depth--;
      if (depth === 0) {
        end = j + 1;
        break;
      }
    }
  }
  expect(end, 'funnelApproverWeeklySvg must be brace-balanced').toBeGreaterThan(-1);
  const src = APP.slice(start, end);
  // `esc` is defined elsewhere in app.js; supply an equivalent.
  const factory = new Function('esc', `${src}; return funnelApproverWeeklySvg;`) as (
    esc: (s: string) => string,
  ) => (weekly: unknown) => string;
  return factory((s: string) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'));
}

const funnelApproverWeeklySvg = loadChart();

const week = (o: Record<string, unknown> = {}) => ({
  weekStart: '2026-07-20',
  total: 6,
  wouldApprove: 4,
  block: 1,
  abstain: 1,
  withHumanVerdict: 3,
  agreedApprove: 1,
  agreedBlock: 1,
  falseApprove: 1,
  falseBlock: 0,
  agreementPct: 66.7,
  ...o,
});

describe('weekly approver agreement chart', () => {
  it('renders nothing for an absent or empty field (older snapshot)', () => {
    expect(funnelApproverWeeklySvg(undefined)).toBe('');
    expect(funnelApproverWeeklySvg(null)).toBe('');
    expect(funnelApproverWeeklySvg([])).toBe('');
  });

  it('renders an SVG with the go-live caption for real weeks', () => {
    const html = funnelApproverWeeklySvg([week(), week({ weekStart: '2026-07-27', agreementPct: 80 })]);
    expect(html).toContain('<svg');
    expect(html).toContain('Weekly approver agreement');
    // The three go-live signals must be spelled out.
    expect(html).toContain('agreement ↑');
    expect(html).toContain('abstain ↓');
    expect(html).toContain('false-approve → 0');
  });

  it('emphasizes the safety-critical false-approve in its own red', () => {
    const html = funnelApproverWeeklySvg([week({ falseApprove: 2 })]);
    // The alarm color appears both as the bar segment and the count line.
    expect(html).toContain('#f85149');
    // A dashed false-approve count line rides over the bars.
    expect(html).toContain('stroke-dasharray');
  });

  it('breaks the agreement line at a no-verdict week instead of plotting a 0 or NaN', () => {
    const html = funnelApproverWeeklySvg([
      week({ weekStart: '2026-07-20', agreementPct: 66.7 }),
      week({ weekStart: '2026-07-27', withHumanVerdict: 0, agreedApprove: 0, agreedBlock: 0, falseApprove: 0, agreementPct: null }),
      week({ weekStart: '2026-08-03', agreementPct: 100 }),
    ]);
    // Never a NaN coordinate, even with a null-agreement week in the middle.
    expect(html).not.toContain('NaN');
    // The null week is skipped, so the agreement line is drawn as TWO segments.
    const polylines = (html.match(/<polyline/g) || []).length;
    // one false-approve line + two agreement segments
    expect(polylines).toBeGreaterThanOrEqual(3);
  });

  it('escapes week labels and survives non-numeric fields without throwing', () => {
    const html = funnelApproverWeeklySvg([
      week({ weekStart: '2026-07-20<x>', total: null, falseApprove: undefined, abstain: 'x' }),
    ]);
    expect(html).toContain('<svg');
    expect(html).not.toContain('NaN');
    expect(html).not.toContain('<x>'); // raw label escaped
  });
});
