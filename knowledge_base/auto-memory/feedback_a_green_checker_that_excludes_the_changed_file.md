---
name: feedback_a_green_checker_that_excludes_the_changed_file
description: "A passing checker is evidence only about the files IN ITS PROGRAM. Measured on nanoclaw#1117: author cited `tsc --noEmit` exit 0 as verification, but tsconfig has include:[src/**/*] and no allowJs — the one changed file (dashboard/public/app.js) was not in the program, and tsc WOULD have caught the shipped bug."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 6ad20816-a26f-4842-bae5-05ae5f6f77c3
---

# A green checker that excludes the changed file is not evidence about the change

Measured 2026-08-06 on `slang-coworkers/nanoclaw#1117` (one file changed:
`dashboard/public/app.js`). The PR body's Verification section read:

- `node --check dashboard/public/app.js` — exit **0**  ← real, names the file
- `tsc --noEmit -p tsconfig.json` — exit **0**, 0 errors  ← **vacuous for this PR**

`tsconfig.json` has `"include": ["src/**/*"]` and sets neither `allowJs` nor `checkJs`. So
`dashboard/public/app.js` **is not in the tsc program at all**. The exit 0 is a true statement
about `src/**`, offered as verification of a change that touches nothing there.

**Why it mattered:** the shipped bug was a type mismatch (`Array.isArray()` on a field the
producer emits as a string) — *precisely* what a type-checker catches. The check that would have
found it was cited as having passed.

## The rule

⭐⭐⭐ **Before crediting a green checker, ask which files are IN ITS PROGRAM — and confirm the
changed file is one of them.** For each tool the answer lives in a config you can read in one
command:

| tool | where the program is defined | the trap |
|---|---|---|
| `tsc` | `tsconfig.json` `include`/`files`/`exclude`, plus `allowJs`/`checkJs` for `.js` | `.js` silently excluded without `allowJs` |
| `prettier --check` / eslint | the glob in the `package.json` script | `"src/**/*.ts"` excludes `dashboard/**` entirely |
| `vitest` / `bun test` | `vitest.config.ts` include/exclude | a tree can be excluded wholesale |
| CI job | the workflow's `paths:`/`branches:` filter | a job that never ran reports no failure |

**Cheapest detector:** the checker's output should *name* the changed file, or you should be able
to make it fail by breaking that file. `node --check <file>` passes this by construction (the file
is the argument); `tsc -p <config>` does not.

## Generalisation — this is the same shape as a false zero

A checker excluding the target and a `grep` in the wrong directory produce identical evidence:
**a clean result about a set you never examined.** Related: [[feedback_a_failed_cd_makes_the_next_grep_a_false_zero]]
(instrument aimed at the wrong target), and the store's standing rule that every check needs its
FAILURE distinguishable from its NEGATIVE result — here, "no type errors in the changed file" and
"the changed file was never type-checked" are the same exit 0.

⚠️**Reviewer-side corollary:** when a PR body lists verification commands, the cheap, high-yield
move is to check each command's SCOPE, not to re-run it. Re-running reproduces the same vacuous
green. On #1117 the scope check took one `cat tsconfig.json` and turned a claimed verification into
a finding. The author's *other* two scope claims (`node --check`, and prettier gating only
`src/**/*.ts`) were **correct** — so this is per-claim verification, not distrust of the author.
