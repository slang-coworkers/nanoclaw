/**
 * The content phase changed composed bytes on purpose. This bounds by how much.
 *
 * Reviewing the commit diff is not enough: a squash, a rebase, or a later edit to
 * the same goldens all erase that evidence. So the pre-change goldens are kept as
 * immutable fixtures, the substitution is applied PROGRAMMATICALLY, and the result
 * is compared to the shipped goldens. If anything else moved, the transform cannot
 * reproduce them.
 *
 * The fix: `agents.md:20` pointed at `#chain-reporting`, which resolves to nothing —
 * measured, zero matching sections in any composed document. `main-body.md:25`
 * already links the same concept as `#chain-communication--the-rules`, which does
 * exist (`main.md:234`), so this is a retarget to the section that was always meant,
 * not a de-link.
 *
 * Two later content changes are bounded the same way. `base-common` gained the
 * `explain-diff-html` skill, which adds exactly one `## Skills` line to every
 * non-`main` composed document (`main` is flat and lists no skills). Then the
 * group-scope `ncl` table gained its `tasks` and `pr-mappings` rows — two
 * resources a group-scoped agent could already reach and was never told about.
 *
 * The pre-change fixtures stay immutable; stripping those three lines from the
 * shipped golden must reproduce them byte for byte. Each strip asserts exact
 * cardinality first, so a transform applied twice, or a second edit that happened
 * to cancel out, still fails.
 */
import fs from 'fs';
import path from 'path';

import { describe, expect, it } from 'vitest';

import { composeCoworkerSpine } from '../claude-composer.js';
import { PARITY_MCP, PARITY_PERSONA } from './parity.fixtures.js';

const GOLDEN_DIR = path.join(import.meta.dirname, '__goldens__');
const PRE_DIR = path.join(import.meta.dirname, '__goldens__', 'pre-anchor-retarget');

const OLD_ANCHOR = '[chain-reporting](#chain-reporting)';
const NEW_ANCHOR = '[chain-reporting](#chain-communication--the-rules)';

/** Only `main` carries `agents.md`; the other two types compose without it. */
const AFFECTED = ['main', 'main.persona'] as const;
/** Untouched by the retarget; moved once since, by the `explain-diff-html` skill line. */
const SKILL_LINE_ONLY = ['base-common', 'base-common.persona', 'default', 'default.persona'] as const;

const SKILL_LINE_KEY = '`/explain-diff-html`';
const SKILL_LINE_RE = /^- `\/explain-diff-html` — [^\n]*\n/m;

/** The two group-scope `ncl` rows added after the pre-change fixtures were taken. */
const NCL_ROWS: readonly { key: string; re: RegExp }[] = [
  { key: '| `tasks`  ', re: /^\| `tasks` +\|[^\n]*\n/m },
  { key: '| `pr-mappings`', re: /^\| `pr-mappings` +\|[^\n]*\n/m },
];

function golden(dir: string, name: string): string {
  return fs.readFileSync(path.join(dir, `${name}.md`), 'utf-8');
}

describe('the anchor retarget is the only content change', () => {
  for (const name of AFFECTED) {
    it(`${name}: applying the substitution to the pre-change golden reproduces the shipped one`, () => {
      const before = golden(PRE_DIR, name);

      // Exact cardinality, asserted before transforming. "Transformed equality"
      // alone would also pass if the substitution had been applied twice, or if a
      // second unrelated edit happened to cancel out.
      expect(before.split(OLD_ANCHOR).length - 1).toBe(1);

      const transformed = before.replaceAll(OLD_ANCHOR, NEW_ANCHOR);

      expect(transformed).toBe(golden(GOLDEN_DIR, name));
      // Byte delta is the length difference of the two anchor strings, nothing more.
      expect(Buffer.byteLength(transformed) - Buffer.byteLength(before)).toBe(
        Buffer.byteLength(NEW_ANCHOR) - Buffer.byteLength(OLD_ANCHOR),
      );
    });
  }

  for (const name of SKILL_LINE_ONLY) {
    it(`${name}: differs from the pre-change golden by the skill line and the two ncl rows only`, () => {
      const shipped = golden(GOLDEN_DIR, name);
      const before = golden(PRE_DIR, name);

      // Exactly one occurrence of each, asserted before stripping — same reasoning
      // as above, and it is why each addition is listed individually rather than
      // stripped by one permissive pattern.
      expect(shipped.split(SKILL_LINE_KEY).length - 1).toBe(1);
      expect(before).not.toContain(SKILL_LINE_KEY);
      for (const row of NCL_ROWS) {
        expect(shipped.split(row.key).length - 1, `${row.key} must appear once in the shipped golden`).toBe(1);
        expect(before, `${row.key} must be absent from the immutable fixture`).not.toContain(row.key);
      }

      let stripped = shipped.replace(SKILL_LINE_RE, '');
      for (const row of NCL_ROWS) stripped = stripped.replace(row.re, '');
      expect(stripped).toBe(before);
    });
  }

  it('leaves no unresolved chain-reporting anchor in any composed document', () => {
    for (const type of ['base-common', 'main', 'default']) {
      const out = composeCoworkerSpine({
        coworkerType: type,
        extraInstructions: PARITY_PERSONA,
        mcpInstructions: PARITY_MCP,
        projectRoot: process.cwd(),
      });

      expect(out, type).not.toContain(OLD_ANCHOR);
    }
  });

  // The retarget is only correct if the new anchor's slug actually exists. `main` is
  // the type that carries both the reference and the target section.
  it('points at a section that exists', () => {
    const out = composeCoworkerSpine({ coworkerType: 'main', projectRoot: process.cwd() });
    const slugs = new Set(
      (out.match(/^#{1,6} .+$/gm) ?? []).map((h) =>
        h
          .replace(/^#+ /, '')
          .toLowerCase()
          .replace(/[^a-z0-9 -]/g, '')
          .trim()
          .replace(/ /g, '-'),
      ),
    );

    expect(slugs).toContain('chain-communication--the-rules');
  });
});
