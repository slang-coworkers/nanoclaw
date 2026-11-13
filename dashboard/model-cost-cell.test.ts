/**
 * Rendering contract for the Cost cell of the "By Model" table in
 * dashboard/public/app.js. A model with no rate has real tokens and an unknown
 * cost; the cell must say so in words, not print $0.00.
 *
 * app.js is a browser script with no exports, so the function is extracted from
 * source and evaluated, as unit-cost-panel.test.ts does.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = fs.readFileSync(path.join(HERE, 'public', 'app.js'), 'utf-8');

function loadCell(): (model: string, cost: number, unpriced: unknown) => string {
  const start = APP.indexOf('function modelCostCellHtml(');
  expect(start, 'modelCostCellHtml must exist in app.js').toBeGreaterThan(-1);
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
  expect(end, 'modelCostCellHtml must be brace-balanced').toBeGreaterThan(-1);
  const factory = new Function('fmtUsd', `${APP.slice(start, end)}; return modelCostCellHtml;`) as (
    fmtUsd: (n: number) => string,
  ) => (model: string, cost: number, unpriced: unknown) => string;
  return factory((n: number) => `$${n.toFixed(2)}`);
}

describe('modelCostCellHtml', () => {
  const cell = loadCell();

  it('says "no rate" for a model the cost feed lists as unpriced', () => {
    const html = cell('nvidia/new-vendor/model-x', 0, ['nvidia/new-vendor/model-x']);
    expect(html).toContain('no rate');
    expect(html).not.toContain('$');
  });

  it('prints the figure for a priced model', () => {
    expect(cell('glm-5.3', 1.5, ['nvidia/new-vendor/model-x'])).toContain('$1.50');
  });

  it('prints the figure when the feed has no unpriced list', () => {
    expect(cell('claude-opus-5-5', 2, undefined)).toContain('$2.00');
  });
});
