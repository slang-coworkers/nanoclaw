/**
 * Rendering contract for the unit-cost panel (dashboard/public/app.js).
 *
 * `unitCostByWeek` is careful to return `costPerPr: null` for the two states
 * that are not a quotient — a week with no transcript coverage, and a week with
 * spend but no PR opened. A renderer can throw that care away in one line by
 * printing `$${w.costPerPr}` and turning both into "$0", which reads as a free
 * week and, on the trend line, as a saving that never happened.
 *
 * These tests pin the three states apart at the pixel level:
 *
 *   no data for the week    -> words, no figure
 *   spend but no PR opened  -> words, no figure
 *   a real quotient         -> a figure
 *
 * app.js is a browser script with no module exports, so the function is
 * extracted from source and evaluated. Crude, but it tests the SHIPPED code
 * rather than a copy — and it fails loudly if the function is renamed.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = fs.readFileSync(path.join(HERE, 'public', 'app.js'), 'utf-8');

function loadPanel(): (uc: unknown) => string {
  const start = APP.indexOf('function unitCostHtml(');
  expect(start, 'unitCostHtml must exist in app.js').toBeGreaterThan(-1);
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
  expect(end, 'unitCostHtml must be brace-balanced').toBeGreaterThan(-1);
  const factory = new Function('esc', `${APP.slice(start, end)}; return unitCostHtml;`) as (
    esc: (s: string) => string,
  ) => (uc: unknown) => string;
  return factory((s: string) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'));
}

const week = (over: Partial<Record<string, unknown>> = {}) => ({
  week: '2026-07-06',
  cost: 120,
  prs: 2,
  costPerPr: 60,
  hasCost: true,
  ...over,
});

describe('unitCostHtml', () => {
  const render = loadPanel();

  it('renders a real quotient as a figure', () => {
    const html = render({ weeks: [week()], groupsMissing: [], unavailable: null });
    expect(html).toContain('$60');
    expect(html).toContain('2 PRs');
  });

  it('says so in WORDS when the metric is unavailable, and shows no figure', () => {
    const html = render({ weeks: [], groupsMissing: [], unavailable: 'ccusage not resolvable' });
    expect(html).toContain('Unavailable');
    expect(html).toContain('ccusage not resolvable');
    expect(html).not.toMatch(/\$\d/);
  });

  it('shows "no data" — never $0 — for a week with no coverage', () => {
    const html = render({
      weeks: [week({ hasCost: false, cost: 0, prs: 0, costPerPr: null })],
      groupsMissing: [],
      unavailable: null,
    });
    expect(html).toContain('no data');
    // The regression this guards: a missing week rendering as a free week.
    expect(html).not.toMatch(/\$0\b/);
  });

  it('shows "no PR opened" — never $0 — for a week with spend but no PR', () => {
    const html = render({
      weeks: [week({ prs: 0, costPerPr: null })],
      groupsMissing: [],
      unavailable: null,
    });
    expect(html).toContain('no PR opened');
    expect(html).not.toMatch(/\$0\b/);
  });

  it('computes the trend only across PRICED weeks', () => {
    // A no-data week between two priced ones must not become an endpoint of
    // the delta — that would manufacture a trend out of missing coverage.
    const html = render({
      weeks: [
        week({ week: '2026-07-06', costPerPr: 270 }),
        week({ week: '2026-07-13', hasCost: false, costPerPr: null, prs: 0 }),
        week({ week: '2026-07-20', costPerPr: 153 }),
      ],
      groupsMissing: [],
      unavailable: null,
    });
    expect(html).toContain('$270');
    expect(html).toContain('$153');
    expect(html).toContain('2 priced weeks');
    expect(html).toMatch(/43%/); // (153-270)/270 = -43%
  });

  it('names groups with no cost data instead of quietly understating', () => {
    const html = render({
      weeks: [week()],
      groupsMissing: ['slangpy-reviewer'],
      unavailable: null,
    });
    expect(html).toContain('slangpy-reviewer');
    expect(html).toMatch(/understated/i);
  });

  it('escapes values rather than interpolating them raw', () => {
    const html = render({ weeks: [], groupsMissing: [], unavailable: '<img src=x onerror=1>' });
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
  });

  it('returns empty for a null payload rather than throwing', () => {
    expect(render(null)).toBe('');
  });
});
