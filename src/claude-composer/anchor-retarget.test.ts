/**
 * Composed-document content is bounded to a declared set of differences.
 *
 * Reviewing a commit diff is not enough: a squash, a rebase, or a later edit to the
 * same goldens all erase that evidence. So the pre-change goldens are kept as
 * immutable fixtures, the differences are declared here, applied PROGRAMMATICALLY,
 * and the result compared to the shipped goldens. Anything else that moved makes the
 * transform unable to reproduce them.
 *
 * The declared set, and the form each takes:
 *
 * - `agents.md`'s `#chain-reporting` anchor resolves to nothing; `main-body.md`
 *   already links the same concept as `#chain-communication--the-rules`, which
 *   exists. A string substitution, `main` only — the only type carrying `agents.md`.
 * - `base-common` gains the `explain-diff-html` skill: one `## Skills` line in every
 *   non-`main` document (`main` is flat and lists no skills). A line strip.
 * - Two group-scope `ncl` rows, `tasks` and `pr-mappings`. Line strips, matched
 *   against their full reviewed text so a later edit to a row cannot pass through.
 * - `## Resident Skill Instructions`, the resident half of a skill dir's contract.
 *   A section strip, rebuilt from the skill's own `instructions.md`.
 * - Four fragments whose bodies differ from the fixtures'. Whole-body substitutions
 *   for the ones `main` emits verbatim, line substitutions where typed composition
 *   re-levels headings; the post-edit side is digest-pinned, because reading the
 *   live file alone would let the next edit launder itself through a regenerated
 *   golden.
 *
 * Each transform asserts exact cardinality before applying, so a substitution
 * applied twice, or a second edit that happens to cancel out, still fails.
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

import { describe, expect, it } from 'vitest';

import { composeCoworkerSpine } from '../claude-composer.js';
import { PARITY_MCP, PARITY_PERSONA } from './parity.fixtures.js';

const GOLDEN_DIR = path.join(import.meta.dirname, '__goldens__');
const PRE_DIR = path.join(import.meta.dirname, '__goldens__', 'pre-anchor-retarget');

const OLD_ANCHOR = '[chain-reporting](#chain-reporting)';
const NEW_ANCHOR = '[chain-reporting](#chain-communication--the-rules)';

/** Only `main` carries `agents.md`, so only its goldens hold the anchor. */
const AFFECTED = ['main', 'main.persona'] as const;
/** Goldens without the anchor; their declared differences are the strips and line substitutions. */
const TYPED_GOLDENS = ['base-common', 'base-common.persona', 'default', 'default.persona'] as const;

const SKILL_LINE_KEY = '`/explain-diff-html`';
const SKILL_LINE_RE = /^- `\/explain-diff-html` — [^\n]*\n/m;

/**
 * The two group-scope `ncl` rows absent from the pre-change fixtures.
 *
 * Full reviewed text: a pattern matching any row body would strip an unreviewed edit
 * as readily as the reviewed one, leaving the content unbounded while appearing to
 * account for it.
 */
const NCL_ROWS: readonly string[] = [
  '| `tasks`        | `list`, `get`, `create`, `update`, `cancel`, `pause`, `resume`, `delete`, `run`, `append-log` | Your scheduled tasks — this is the whole surface for them, including creating one. `/base-nanoclaw` has the gate-script and fresh-session detail. |\n',
  '| `pr-mappings`  | `list`                                          | Which PR routes to which of your sessions. You claim a mapping with `report_pr_created`, not here; `remap` is approval-gated. |\n',
];

const RESIDENT_HEADING = '## Resident Skill Instructions';

/**
 * Fragments `main` emits verbatim and no other type binds, so a body substitution
 * here cannot affect the other four goldens.
 */
const REWRITTEN_FRAGMENTS: readonly { name: string; file: string }[] = [
  { name: 'self-mod', file: 'tool-instructions/self-mod.md' },
  { name: 'interactive', file: 'tool-instructions/interactive.md' },
  { name: 'scheduling', file: 'tool-instructions/scheduling.md' },
  { name: 'main-body', file: 'identity/main-body.md' },
];

/**
 * Line-level rewrites in fragments the TYPED goldens bind.
 *
 * Whole-body substitution suits the flat path, where bodies are verbatim. Typed
 * composition re-levels a fragment's headings, so only content that survives
 * re-leveling — a table row, a bullet — can be matched as an exact string.
 */
const REWRITTEN_LINES: readonly { was: string; now: string }[] = [
  // `NCL_ROWS` covers the rows the fixtures never had; this list covers rows they did.
  {
    was: '| `wirings`      | `get`, `update`                                 | Tune engagement for THIS conversation only: engage_mode / engage_pattern. |',
    now: '| `wirings`      | `get`, `update`                                 | Tune engagement for THIS conversation only: engage_mode / engage_pattern. `update` needs human approval; task mutations do not. |',
  },
  {
    was: ' One task per subagent. For recurring/cron work, use `schedule_task` instead.',
    now: ' One task per subagent.',
  },
];

const SPINE_DIR = path.join(process.cwd(), 'container', 'spines', 'base');
const PRE_FRAGMENT_DIR = path.join(PRE_DIR, 'fragments');

/**
 * Digest of each rewritten fragment as reviewed. Reading the post-edit side from
 * the live file alone would launder the next edit: change the fragment, regenerate
 * the golden, and a transform that copies whatever the file now says still
 * reproduces it. Pinning the approved bytes is what makes the substitution a bound
 * rather than a restatement.
 */
const REWRITTEN_DIGESTS: Record<string, string> = {
  'self-mod': '0866043b4f374c02',
  interactive: '130cf99ad06bfa82',
  scheduling: '938fe0586a5f9891',
  'main-body': '4b87455dbab340b5',
};

/** Replace each pre-edit fragment body with the reviewed post-edit body. */
function applyFragmentRewrites(before: string): string {
  let out = before;
  for (const { name, file } of REWRITTEN_FRAGMENTS) {
    const was = fs.readFileSync(path.join(PRE_FRAGMENT_DIR, `${name}.md`), 'utf-8').trim();
    const now = fs.readFileSync(path.join(SPINE_DIR, file), 'utf-8').trim();
    expect(
      crypto.createHash('sha256').update(now).digest('hex').slice(0, 16),
      `${file} changed since it was reviewed — read the diff, regenerate the goldens, ` +
        `and update this digest in the same commit`,
    ).toBe(REWRITTEN_DIGESTS[name]);
    // Exactly once, and actually changed: a fragment that no longer differs means
    // its entry here is stale and should be retired rather than left passing.
    expect(out.split(was).length - 1, `${file}'s pre-edit body must appear once in the fixture`).toBe(1);
    expect(now, `${file} matches its pre-edit fixture — retire this entry`).not.toBe(was);
    out = out.replace(was, now);
  }
  return out;
}

/** Apply the line-level rewrites the typed goldens carry. */
function applyLineRewrites(before: string): string {
  let out = before;
  for (const { was, now } of REWRITTEN_LINES) {
    expect(out.split(was).length - 1, `a rewritten line must appear once in the fixture: ${was.slice(0, 60)}`).toBe(1);
    out = out.replace(was, now);
  }
  return out;
}

/**
 * The exact bytes the resident section adds, rebuilt from the skill's own
 * `instructions.md` rather than from the composer.
 *
 * Deriving it from the source file is what makes the strip a real bound: a
 * transform that merely deleted everything between two headings would also absorb
 * an edit made INSIDE the section, which is the one thing this file exists to rule
 * out. The `####` leveling is spelled out here on purpose — reusing the composer's
 * `normalizeFragment` would make the assertion agree with itself.
 *
 * Only `onecli-gateway` ships an `instructions.md` today; a second one turns the
 * cardinality assertion red, which is the intended prompt to update this.
 */
function residentSectionBytes(): string {
  const body = fs
    .readFileSync(path.join(process.cwd(), 'container', 'skills', 'onecli-gateway', 'instructions.md'), 'utf-8')
    .trim()
    .replace(/^# /m, '#### ');
  return `\n${RESIDENT_HEADING}\n\n### \`/onecli-gateway\`\n\n${body}\n`;
}

/** Remove that exact block, leaving the document as it stood before. */
function stripResidentSection(doc: string): string {
  const block = residentSectionBytes();
  // Byte for byte, exactly once: a changed prohibition, a changed heading level, or
  // a second shipped instructions.md all fail here rather than passing through.
  expect(doc.split(block).length - 1).toBe(1);
  return doc.replace(block, '');
}

function golden(dir: string, name: string): string {
  return fs.readFileSync(path.join(dir, `${name}.md`), 'utf-8');
}

describe('composed-document content changes are bounded to the declared set', () => {
  for (const name of AFFECTED) {
    it(`${name}: applying the substitution to the pre-change golden reproduces the shipped one`, () => {
      const before = golden(PRE_DIR, name);

      // Exact cardinality, asserted before transforming. "Transformed equality"
      // alone would also pass if the substitution had been applied twice, or if a
      // second unrelated edit happened to cancel out.
      expect(before.split(OLD_ANCHOR).length - 1).toBe(1);

      const transformed = applyFragmentRewrites(before.replaceAll(OLD_ANCHOR, NEW_ANCHOR));

      expect(before).not.toContain(RESIDENT_HEADING);

      expect(transformed).toBe(stripResidentSection(golden(GOLDEN_DIR, name)));
      // Byte delta accounts for every declared change and nothing else: the anchor
      // string's length difference plus each rewritten fragment's.
      const fragmentDelta = REWRITTEN_FRAGMENTS.reduce((sum, { name, file }) => {
        const was = fs.readFileSync(path.join(PRE_FRAGMENT_DIR, `${name}.md`), 'utf-8').trim();
        const now = fs.readFileSync(path.join(SPINE_DIR, file), 'utf-8').trim();
        return sum + Buffer.byteLength(now) - Buffer.byteLength(was);
      }, 0);
      expect(Buffer.byteLength(transformed) - Buffer.byteLength(before)).toBe(
        Buffer.byteLength(NEW_ANCHOR) - Buffer.byteLength(OLD_ANCHOR) + fragmentDelta,
      );
    });
  }

  for (const name of TYPED_GOLDENS) {
    it(`${name}: differs from the pre-change golden by the skill line, ncl rows and resident section only`, () => {
      const shipped = golden(GOLDEN_DIR, name);
      const before = golden(PRE_DIR, name);

      // Exactly one occurrence of each, asserted before stripping — same reasoning
      // as above, and it is why each addition is listed individually rather than
      // stripped by one permissive pattern.
      expect(shipped.split(SKILL_LINE_KEY).length - 1).toBe(1);
      expect(before).not.toContain(SKILL_LINE_KEY);
      for (const row of NCL_ROWS) {
        const key = row.slice(0, row.indexOf('|', 2) + 1);
        expect(shipped.split(row).length - 1, `${key} must appear once, byte for byte, in the shipped golden`).toBe(1);
        expect(before, `${key} must be absent from the immutable fixture`).not.toContain(key);
      }

      expect(before).not.toContain(RESIDENT_HEADING);

      let stripped = stripResidentSection(shipped).replace(SKILL_LINE_RE, '');
      for (const row of NCL_ROWS) stripped = stripped.replace(row, '');
      expect(stripped).toBe(applyLineRewrites(before));
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
