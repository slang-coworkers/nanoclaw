/**
 * The section re-order is bounded to a declared set of moves and additions.
 *
 * `pre-section-reorder/` holds the goldens as they stood after the base-spine trim
 * (the set `anchor-retarget.test.ts` reproduces). Between that state and the shipped
 * goldens three things changed, and only those three:
 *
 * - typed documents gain `## Rules` right after `## Identity`, composed from the
 *   two rule fragments (decision table, report formats) — digest-pinned here;
 * - the `## NanoClaw Runtime Contract` section stops leading the typed document
 *   and its body becomes the tail of `## Context` (flat `main` keeps its section);
 * - `chain-reporting.md` carries the GitHub invariant under its own
 *   `### GitHub as primary observability` heading (every document) — digest-pinned.
 *
 * Because a re-order moves whole blocks, the bound is stated on LINES: the multiset
 * of lines in the shipped golden equals the pre golden's multiset plus the declared
 * added lines minus the declared removed lines. A reworded sentence anywhere else
 * shows up as an unmatched line on one side and fails the test. The section ORDER is
 * asserted separately.
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

import { describe, expect, it } from 'vitest';

const GOLDEN_DIR = path.join(import.meta.dirname, '__goldens__');
const PRE_DIR = path.join(GOLDEN_DIR, 'pre-section-reorder');
const SPINE_DIR = path.join(process.cwd(), 'container', 'spines', 'base', 'context');

const TYPED = ['base-common', 'base-common.persona', 'default', 'default.persona'] as const;
const FLAT = ['main', 'main.persona'] as const;

/** Digests of the reviewed fragments, so the live file cannot launder a later edit. */
const FRAGMENT_DIGESTS: Record<string, string> = {
  'decision-table.md': '66ea8a0e1438a818',
  'report-formats.md': 'd1c3c15359a95792',
  'chain-reporting.md': 'bb04e4ba676253be',
};
/** The chain-reporting fragment as it stood before the heading was added. */
const OLD_CHAIN_REPORTING = path.join(GOLDEN_DIR, 'pre-anchor-retarget', 'fragments', 'chain-reporting.post-trim.md');

const TYPED_ORDER = [
  'Identity',
  'Rules',
  'Invariants',
  'Context',
  'How to Work',
  'Workflows',
  'Skills',
  'Resident Skill Instructions',
  'MCP Servers',
  'Additional Instructions',
];

function digest(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex').slice(0, 16);
}
function fragment(name: string): string {
  const text = fs.readFileSync(path.join(SPINE_DIR, name), 'utf-8');
  expect(digest(text), `${name} differs from the reviewed bytes`).toBe(FRAGMENT_DIGESTS[name]);
  return text;
}
function lines(text: string): Map<string, number> {
  const m = new Map<string, number>();
  for (const l of text.split('\n')) m.set(l, (m.get(l) ?? 0) + 1);
  return m;
}
function minus(a: Map<string, number>, b: Map<string, number>): Map<string, number> {
  const out = new Map(a);
  for (const [k, n] of b) {
    const left = (out.get(k) ?? 0) - n;
    // Multiset difference: a count that drops to or below zero disappears (a
    // declared added line may already occur elsewhere in both documents).
    if (left <= 0) out.delete(k);
    else out.set(k, left);
  }
  return out;
}
function h2Order(doc: string): string[] {
  return [...doc.matchAll(/^## (.+)$/gm)].map((m) => m[1]);
}
/** Heading levels in a fragment are shifted so the top one is `###`, exactly as the composer does. */
function normalized(text: string): string {
  const top = Math.min(...[...text.matchAll(/^(#{1,6}) /gm)].map((m) => m[1].length));
  const shift = 3 - top;
  return text.replace(/^(#{1,6}) /gm, (_, h: string) => '#'.repeat(h.length + shift) + ' ').trim();
}

describe('composed-document section re-order is bounded to the declared set', () => {
  const rules = () => [fragment('decision-table.md'), fragment('report-formats.md')].map(normalized).join('\n\n');
  const chainNew = () => normalized(fragment('chain-reporting.md'));
  const chainOld = () => normalized(fs.readFileSync(OLD_CHAIN_REPORTING, 'utf-8'));

  for (const name of TYPED) {
    it(`${name}: same lines as before plus Rules and the GitHub heading, minus the contract heading`, () => {
      const before = fs.readFileSync(path.join(PRE_DIR, `${name}.md`), 'utf-8');
      const shipped = fs.readFileSync(path.join(GOLDEN_DIR, `${name}.md`), 'utf-8');
      const added = lines(['## Rules', rules(), chainNew()].join('\n'));
      const removed = lines(['## NanoClaw Runtime Contract', chainOld()].join('\n'));
      // Blank lines move with the blocks; they are not content.
      const strip = (m: Map<string, number>) => {
        m.delete('');
        return m;
      };
      expect([...strip(minus(minus(lines(shipped), lines(before)), added))]).toEqual([]);
      expect([...strip(minus(minus(lines(before), lines(shipped)), removed))]).toEqual([]);
    });
    it(`${name}: sections appear in the §6.4 order`, () => {
      const shipped = fs.readFileSync(path.join(GOLDEN_DIR, `${name}.md`), 'utf-8');
      const order = h2Order(shipped).filter((h) => TYPED_ORDER.includes(h));
      expect(order).toEqual(TYPED_ORDER.filter((h) => order.includes(h)));
      expect(order[0]).toBe('Identity');
      expect(order[1]).toBe('Rules');
    });
  }

  for (const name of FLAT) {
    it(`${name}: differs from before only by the chain-reporting rewrite`, () => {
      const before = fs.readFileSync(path.join(PRE_DIR, `${name}.md`), 'utf-8');
      const shipped = fs.readFileSync(path.join(GOLDEN_DIR, `${name}.md`), 'utf-8');
      // Flat bodies render fragments verbatim, so the fragment's own heading levels apply.
      const added = lines(fragment('chain-reporting.md').trim());
      const removed = lines(fs.readFileSync(OLD_CHAIN_REPORTING, 'utf-8').trim());
      const strip = (m: Map<string, number>) => {
        m.delete('');
        return m;
      };
      expect([...strip(minus(minus(lines(shipped), lines(before)), added))]).toEqual([]);
      expect([...strip(minus(minus(lines(before), lines(shipped)), removed))]).toEqual([]);
    });
  }
});
