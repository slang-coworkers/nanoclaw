/**
 * Rendering contract for the Sessions tab's coworker filter dropdown
 * (dashboard/public/app.js — sessionGroupOptions).
 *
 * Backs a request to add a group-filter dropdown to the Sessions admin
 * table: the fleet-wide p50/p75/p90/p99/max cost pills blend every
 * coworker's spend into one distribution, which isn't a number anyone can
 * act on — this pins the dedup/sort logic that populates the dropdown used
 * to re-scope those pills (and the table) to one coworker at a time.
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

function loadFn(): (sessions: unknown[]) => Array<[string, string]> {
  const start = APP.indexOf('function sessionGroupOptions(');
  expect(start, 'sessionGroupOptions must exist in app.js').toBeGreaterThan(-1);
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
  expect(end, 'sessionGroupOptions must be brace-balanced').toBeGreaterThan(-1);
  const factory = new Function(`${APP.slice(start, end)}; return sessionGroupOptions;`) as () => (
    sessions: unknown[],
  ) => Array<[string, string]>;
  return factory();
}

describe('sessionGroupOptions', () => {
  const fn = loadFn();

  it('returns one entry per distinct group_folder, using group_name as the label', () => {
    const out = fn([
      { group_folder: 'ag-a', group_name: 'Slang Fixer' },
      { group_folder: 'ag-b', group_name: 'Slang Reviewer' },
    ]);
    expect(out).toEqual([
      ['ag-a', 'Slang Fixer'],
      ['ag-b', 'Slang Reviewer'],
    ]);
  });

  it('dedups multiple sessions from the same coworker into one entry', () => {
    const out = fn([
      { group_folder: 'ag-a', group_name: 'Slang Fixer' },
      { group_folder: 'ag-a', group_name: 'Slang Fixer' },
      { group_folder: 'ag-a', group_name: 'Slang Fixer' },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]).toEqual(['ag-a', 'Slang Fixer']);
  });

  it('falls back to group_folder as the label when group_name is missing', () => {
    const out = fn([{ group_folder: 'ag-1776713211742-1w6l4e', group_name: null }]);
    expect(out).toEqual([['ag-1776713211742-1w6l4e', 'ag-1776713211742-1w6l4e']]);
  });

  it('skips rows with no group_folder (orphaned/malformed sessions)', () => {
    const out = fn([{ group_folder: null, group_name: 'ghost' }, { group_name: 'no folder either' }, {}]);
    expect(out).toEqual([]);
  });

  it('sorts alphabetically by display name, not by folder or insertion order', () => {
    const out = fn([
      { group_folder: 'ag-z', group_name: 'Zebra Reviewer' },
      { group_folder: 'ag-a', group_name: 'Apex Fixer' },
      { group_folder: 'ag-m', group_name: 'Mid Triager' },
    ]);
    expect(out.map((e) => e[1])).toEqual(['Apex Fixer', 'Mid Triager', 'Zebra Reviewer']);
  });

  it('returns an empty array for an empty or missing session list', () => {
    expect(fn([])).toEqual([]);
    expect(fn(undefined as unknown as unknown[])).toEqual([]);
  });
});
