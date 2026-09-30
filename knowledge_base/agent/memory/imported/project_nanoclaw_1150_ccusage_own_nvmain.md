---
name: project_nanoclaw_1150_ccusage_own_nvmain
description: "nanoclaw#1150 (szihs) own ccusage on nv-main + runtime-resolvable guard — MERGED 2026-08-09 at 663f7235 after 4 review rounds (cmts 5230921344/5231002917/5231072274/5231218120). Blockers fixed: guard placement (compose-check.yml + merge-train rollback), Node-20 err.code undefined. 3 latent nits SHIPPED and still live on nv-main 09-29: BOM false-positive, false Node-24/20 comment at :172, summary 'and run' on skipped smoke."
metadata:
  node_type: memory
  type: project
  originSessionId: a5b972af-7843-4f33-bba2-5d5f162f197f
---

# `slang-coworkers/nanoclaw#1150` — "deps: own ccusage on nv-main, and assert runtime specifiers actually resolve"

Author **szihs**, base `nv-main`, branch `fix/nv-main/ccusage-composed-lock`. **MERGED
2026-08-09T12:07Z at `663f7235`.** Reviewed inline by Main (nanoclaw-platform fork, no approver wired —
see [[project_nanoclaw_pr874_webhook_route_approver]]). Direct follow-up to my
[[project_nanoclaw_1122_ccusage_pin_owned_file]] 🔴1, whose pre-registered RESUME prediction turned the
review into a test rather than a fresh read.

## What shipped (verified by execution each round)
- **Core fix correct.** Replaying `merge-train.sh:108-113` with `origin/nv-main` as the only variable:
  base `8d108b2f` → manifest `ccusage` 0 / lock 0 (reproduces #1122 🔴1); PR → 1 / 21. Presence control
  `dashboard/server.ts` blob `9b177602`. ccusage@20.0.19 published 2026-07-27 (past the 3-day gate), no
  install lifecycle hook ⇒ no `minimumReleaseAgeExclude` / `onlyBuiltDependencies` needed.
- **`scripts/check-runtime-resolvable.mjs`** classifies each runtime specifier: ok · MISSING DEPENDENCY
  · UNEXPORTED SUBPATH · UNDECLARED TRANSITIVE · RESOLVED OUTSIDE THIS CHECKOUT · RESOLVES BUT DOES NOT
  RUN (`--version` smoke) · DAMAGED INSTALL. Runs in `ci.yml`, `compose-check.yml`, and inside
  `merge-train.sh:131-148` under `rollback_and_fail` (a stripped dep rolls the merge back).

## Round history (compressed)
| round | head | outcome |
|---|---|---|
| R1 | `f08f02e1` | 🔴 guard only in `ci.yml` — the one nv-main file that cannot compose itself (`ownership.py:41-52`; a leaf PR runs its own `ci.yml`), so the silent deploy path was unguarded. 🟡 resolution ≠ execution (native optional dep missing ⇒ `$0.00`); 🟡 no tests |
| R2 | `b451aa7e` | all R1 items resolved and over-delivered; the author added the `OUTSIDE` class I missed (`require.resolve` walks above the root). New 🔴: CI red on Node 20 — `err.code` is `undefined` for a bad manifest, so a damaged install classified as UNDECLARED TRANSITIVE |
| R3 | `b10b7ea3` | blocker closed by parsing the manifest itself (version-independent, better than my message-regex). CI green 2262 passed. 🟡 false mechanism comment; 🟡 BOM manifest ⇒ DAMAGED INSTALL on a healthy install |
| R4 | `663f7235` | CI green; the author closed an ENOENT hole I never found (no `package.json` still resolved a deep file ⇒ my R2/R3 passes had certified a broken install). R3 🟡s carried; 🟡 new: summary line overstates |

## Residual latent defects — still live on nv-main (re-checked 2026-09-29)
All in `scripts/check-runtime-resolvable.mjs`, each a one-liner:
1. **BOM false positive.** `manifestProblem` (`:177-181`) `JSON.parse`s raw bytes; a BOM-prefixed
   manifest resolves, `require()`s, and runs, yet the guard says DAMAGED INSTALL rc=1 — and under
   `merge-train.sh` that rolls back a healthy merge. Fix: strip `^﻿` before parse. Latent: 0 of 358
   store manifests carried a BOM.
2. **False mechanism comment at `:172-173`** ("throws on Node 24 and resolves happily on Node 20").
   Probed node 20–24: all five throw; 20 with `code=undefined`, 21–24 with `ERR_INVALID_PACKAGE_CONFIG`.
   It is a code-vs-no-code split, and the comment is the stated justification for `manifestProblem`.
3. **Summary overstates (`:345`)** — prints "…resolve, belong to this checkout, and run" even when
   `smokePlatforms` excluded the host and the smoke was skipped (the honest skip line sits above it).

Reopen only if someone touches this script; there is no live chain.

## Review techniques that paid off
- **Hash the test file across heads before crediting a newly-green suite** (R3: byte-identical ⇒ the
  impl moved, not the expectation). When the test file also changes, diff the `it('…')` **name set**
  (`comm -23`) and count removed lines instead (R4: 9 survive verbatim, 4 added).
- **Revert drill / mutation for non-vacuity:** revert only the `.mjs`, keep the tests ⇒ the exact CI
  failure reproduces by name; each new contract test fails only under its own mutation.
- **Probe the shipped runtime, never infer from my own:** my v22 green was the environment-specific
  claim; a real `npx -y node@20` reproduced CI's red. A UNDICI warning masking `detail:` was my own
  `NODE_USE_ENV_PROXY=1` — a true statement about my environment is not a fact about the tool.
- **When a finding turns on how plausible a state is, construct it** (the BOM manifest).
- **Check a widened false-green guard both ways** (`isOurs` → repoRoot: parent install still rejected,
  workspace vendor case now passes).
- **Placement audit ≠ satisfiability audit:** I found WHERE the gate runs but never asked WHAT could
  satisfy it — the author found `OUTSIDE` and ENOENT.

## My instrument failures (all failed toward the PR's favor, all caught by controls)
- A whole-train replay "agreed with the PR" from a run where `dashboard/server.ts` was absent and rc=128
  — a count over a set never composed. Assert presence before any count.
- `node … | grep -v UNDICI; echo rc=$?` read grep's status (rc=0 for a real rc=1). Publish exit codes
  from unpiped runs only.
- `find` without following pnpm symlinks gave `scanned=0` for the BOM scan. Assert the scan set is
  non-empty (and inject a synthetic positive) before reporting any zero from it.
- Published only what a control could have contradicted, and said so where a row stayed unverified —
  [[feedback_published_negative_env_claims_need_rederivation]].

Related: [[feedback_a_ci_step_added_on_a_parent_branch_does_not_compose]],
[[feedback_a_green_checker_that_excludes_the_changed_file]].
