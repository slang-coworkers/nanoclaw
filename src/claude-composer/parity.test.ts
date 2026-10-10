/**
 * Byte-parity: the composed document must not change while the seam moves.
 *
 * Steps 1-9 of this refactor restructure how a document is assembled without
 * changing what it says, so every one of these goldens must stay byte-identical.
 * Only step 10 (three deliberate content fixes) may update them, and that commit
 * updates them visibly.
 *
 * This is the strongest available check on the refactor, and also the weakest in
 * one specific way, which is why it is not the whole verification plan: the three
 * in-tree types emit NEITHER `## Workflows` NOR `## Gate Protocol` — measured, zero
 * matches — because no coworker-types.yaml under `container/spines` declares
 * `workflows:`. So the highest-risk step has no coverage here, and the synthetic
 * fixtures in `claude-composer.test.ts` carry it instead.
 *
 * ## Why `main` is not byte-pinned
 *
 * Only types whose CONTENT this branch owns can be pinned to a golden here.
 * `main` is not one of them, and the reason is CI, not this refactor:
 * `ci.yml`'s test job merges every nv-* branch first ("test the composed state,
 * not standalone"), so `main` composes with sibling-branch skills that are absent
 * from a standalone checkout —
 * `origin/nv-slang:container/skills/slang-github-webhook/context/routing.md`
 * contributes a whole `## GitHub webhook routing` section, and the projects table
 * gains slang/slangpy rows. Measured: the same tree yields `main` = abaecd63bd33b299
 * standalone and 81022e6ba3c5e18e composed.
 *
 * A golden for `main` is therefore unpinnable from this branch in the environment
 * that matters, and would additionally go red on any unrelated nv-slang skill
 * edit. `base-common` and `default` compose only from nv-main-owned content and
 * ARE stable in both states — CI passes their byte tests while failing `main`'s,
 * which is the evidence for drawing the line exactly here.
 *
 * `main` keeps its coverage from assertions that do not depend on sibling content:
 * determinism and the second-H1 rule below (both over all three types), the
 * golden-to-golden transform in `anchor-retarget.test.ts`, and
 * `section-coverage.test.ts`. Its goldens stay on disk — that transform reads
 * them, and they still document the standalone document.
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

import { describe, expect, it } from 'vitest';

import { composeCoworkerSpine } from '../claude-composer.js';
import { PARITY_MCP, PARITY_PERSONA, PARITY_TYPES } from './parity.fixtures.js';

/** The types composed from nv-main-owned content only — see the header. */
const BYTE_PINNED = ['base-common', 'default'] as const;

const GOLDEN_DIR = path.join(import.meta.dirname, '__goldens__');

function compose(type: string, withExtras: boolean): string {
  return composeCoworkerSpine({
    coworkerType: type,
    extraInstructions: withExtras ? PARITY_PERSONA : undefined,
    mcpInstructions: withExtras ? PARITY_MCP : undefined,
    projectRoot: process.cwd(),
  });
}

describe('composed-document byte parity', () => {
  for (const type of BYTE_PINNED) {
    for (const withExtras of [false, true]) {
      const name = withExtras ? `${type}.persona` : type;

      it(`${name} is byte-identical to its golden`, () => {
        const golden = fs.readFileSync(path.join(GOLDEN_DIR, `${name}.md`), 'utf-8');

        // Compare content, not just the digest: a mismatch should print the diff.
        expect(compose(type, withExtras)).toBe(golden);
      });
    }
  }

  // The digests the design records, asserted directly. Belt and braces over the
  // content comparison above: a golden file edited in the same commit as a
  // regression would let that test pass, and these constants would not.
  it('matches the recorded digests', () => {
    const digests: Record<string, string> = {
      // Moved four times. First after the refactor: base-common gained the
      // `explain-diff-html` skill (one `## Skills` line in every composed doc).
      // Then when the group-scope `ncl` table gained its `tasks` and
      // `pr-mappings` rows — two resources agents could already reach and were
      // never told about. Then when `explain-diff-html`'s description grew the
      // collapsed-PR-comment contract (that one `## Skills` line changed), and again
      // when the explanation moved into the PR description (same line), and again
      // when it moved back out into one explanation comment (same line).
      // Goldens regenerated in the same commit, visibly, every time: that is
      // the point of pinning the digests here as well as the bytes, since a
      // golden edited alongside a regression would go unnoticed.
      //
      // They also include `## Resident Skill Instructions` — every shipped
      // `instructions.md` a type can reach, held in context rather than fetched on
      // demand. So a skill gaining or losing one moves them, deliberately.
      //
      // Scheduling prose is part of them too, and it names `ncl tasks` because no
      // scheduling MCP module is registered.
      //
      // Moved a fifth time by the upstream gateway-seam merge: `container/CLAUDE.md`
      // gained a `## Connecting external accounts` section and it is EMITTED, so
      // every composed doc carries it. `section-completeness.test.ts` is what made
      // that a decision instead of a silent drop.
      //
      // Moved a sixth time by the base-spine trim: the type `description:` now
      // renders under Identity, Skills lines carry one sentence, `buddy` left
      // `base-common.skills`, chain-reporting's mechanics moved to
      // `/base-nanoclaw`, and the contract's Memory and Connecting sections were
      // rewritten. `anchor-retarget.test.ts` declares each of those.
      'base-common': '7f2022b3927e195b',
      'base-common.persona': 'e7a47de9588765d5',
      // `main`/`main.persona` are absent by design, not omission: their bytes depend
      // on sibling-branch skills under CI's composed-state merge (header). The
      // standalone values the content phase produced — a107cc5eae0f5a3b and
      // 7ac61543c0a5dc29, moved once by the `agents.md` anchor retarget and again by
      // the emitted `Connecting external accounts` section — are
      // preserved as the goldens on disk and asserted by `anchor-retarget.test.ts`,
      // which compares golden to golden and so holds in both states.
      default: '42518a076ccdb4f7',
      'default.persona': '559d22cd27ec5573',
    };

    const actual: Record<string, string> = {};
    for (const type of BYTE_PINNED) {
      for (const withExtras of [false, true]) {
        const name = withExtras ? `${type}.persona` : type;
        actual[name] = crypto.createHash('sha256').update(compose(type, withExtras)).digest('hex').slice(0, 16);
      }
    }

    expect(actual).toEqual(digests);
  });

  // Composition is hashed by both the spawn path and the 60s staleness sweep. If
  // it varied between two calls the digests could never agree, and every
  // container would be killed and respawned once a minute, forever.
  it('is deterministic across repeated composition', () => {
    for (const type of PARITY_TYPES) {
      expect(compose(type, true)).toBe(compose(type, true));
    }
  });

  // `main` is the only flat type. Its persona gets the same titled wrapper as a
  // typed coworker's, so an operator prepend never reads as a continuation of
  // the section before it (the resident `/onecli-gateway` block, in practice),
  // and its H1 is re-leveled beneath the wrapper — see parity.fixtures.ts.
  it('wraps an operator persona in Additional Instructions on the flat path', () => {
    const out = compose('main', true);
    const h1s = out.split('\n').filter((l) => /^# \S/.test(l));

    expect(h1s).toEqual(['# Main']);
    expect(out.endsWith('\n## Additional Instructions\n\n### Persona\n\nBe terse.\n')).toBe(true);
  });
});
