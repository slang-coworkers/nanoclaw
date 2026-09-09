/**
 * Every `##` in the shared base document must be accounted for.
 *
 * `renderRuntimeContract` iterates `EMITTED_CONTRACT_SECTIONS` and looks each one
 * up in the parsed document. That direction catches a section upstream RENAMES or
 * REMOVES — the lookup misses and it warns. It cannot catch a section upstream
 * ADDS: an unlisted heading is never consulted, so it reaches no agent, with no
 * warning and no failing test.
 *
 * `container/CLAUDE.md` is shared with upstream (ours differs by one sentence), so
 * upstream adding a section there is the expected event, not a hypothetical. This
 * asserts the inverse direction: emitted ∪ dropped ⊇ the document's headings. A new
 * upstream section then turns this red and carrying-or-dropping becomes a decision
 * with a name attached, instead of an omission nobody sees.
 *
 * Same failure shape as two other bugs found this week — a check that iterates the
 * list it controls rather than the surface it must cover.
 */
import fs from 'fs';
import path from 'path';

import { describe, expect, it } from 'vitest';

import { DROPPED_CONTRACT_SECTIONS, EMITTED_CONTRACT_SECTIONS, RUNTIME_CONTRACT_PATH } from './runtime-contract.js';

function baseDocumentHeadings(): string[] {
  const file = path.join(process.cwd(), RUNTIME_CONTRACT_PATH);
  return fs
    .readFileSync(file, 'utf-8')
    .split('\n')
    .filter((line) => line.startsWith('## '))
    .map((line) => line.slice(3).trim());
}

describe('base-document section coverage', () => {
  it('reads a base document with headings — an empty parse must not pass vacuously', () => {
    // Without this, a moved file or a heading-level change would make the
    // subset assertion below trivially true.
    expect(baseDocumentHeadings().length).toBeGreaterThan(2);
  });

  it('accounts for every heading as either emitted or explicitly dropped', () => {
    const accounted = new Set<string>([...EMITTED_CONTRACT_SECTIONS, ...DROPPED_CONTRACT_SECTIONS]);
    const unaccounted = baseDocumentHeadings().filter((h) => !accounted.has(h));
    expect(
      unaccounted,
      `${RUNTIME_CONTRACT_PATH} has section(s) that are neither emitted into the spine nor on the ` +
        `explicit drop-list, so they reach no agent silently. Add each to EMITTED_CONTRACT_SECTIONS ` +
        `(to carry it) or DROPPED_CONTRACT_SECTIONS (with a reason).`,
    ).toEqual([]);
  });

  it('claims nothing it cannot point at — every declared name exists in the document', () => {
    // The other direction, cheap to add here: a stale entry in either list is a
    // rename we absorbed without noticing, and for an emitted one the render
    // silently drops it with only a log line.
    const headings = new Set(baseDocumentHeadings());
    for (const name of [...EMITTED_CONTRACT_SECTIONS, ...DROPPED_CONTRACT_SECTIONS]) {
      expect(headings.has(name), `'${name}' is declared but not present in ${RUNTIME_CONTRACT_PATH}`).toBe(true);
    }
  });
});
