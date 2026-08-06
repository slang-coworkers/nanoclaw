---
name: project_nanoclaw_1083_drift_check_empty_allowlist
description: "slang-coworkers/nanoclaw#1083 verify-only nv-owned drift check — empty allowlist reports 'ok: no drift' (latent, all 4 overlays have file ABSENT not empty); 8th inline-routing instance"
metadata:
  node_type: memory
  type: project
  originSessionId: gh-issue-slang-coworkers/nanoclaw-1083
---

**slang-coworkers/nanoclaw#1083** — `feat(scripts): verify-only drift check for nv-main-owned files`,
author `nv-slang-bot[bot]`, base `nv-main`, branch `fix/nv-main/nv-owned-drift-check`. 2 new files,
+345/−0: `scripts/check-nv-owned-drift.sh` (147), `setup/nv-owned-drift.test.ts` (198). Head
`bff309c6`. Reviewed 08-05, comment `5191619477`. `mergeable_state: unstable` (ci in_progress),
0 prior reviews/comments.

**ROUTING: handled INLINE by Main — 8th instance** (NanoClaw platform-infra fork, never to a
`*-pr-approver`; see [[project_nanoclaw_pr874_webhook_route_approver]], [[project_nanoclaw_1082_ncl_mcp_tools_verbs]]).

## 🔴 The finding: empty allowlist ⇒ "ok: no drift" + exit 0

`git show "$REF:.github/nv-path-guard/nv-main.txt"` **succeeds on a present-but-empty file**, so the
`|| { …skipping…; exit 0; }` guard never fires. Empty `$OWNED_LIST` ⇒ `is_owned()` matches nothing ⇒
`drift` empty ⇒ prints `ok: no nv-main-owned file differs` and **exits 0** with drift present.

⭐⭐⭐**ALL THREE SIBLING READERS CARRY THE GUARD THIS ONE DROPS**, and the PR claims parity with them:
`merge-train.sh:45`, `setup.sh:202` (`fork_is_owned`), `ci.yml:63` — each `[ -s "$NV_OWNED_LIST" ] || return 1`,
merge-train's comment naming the rationale ("own nothing, so every conflict surfaces loudly").
⭐⭐**But the FAIL DIRECTION INVERTS, so it is not a copy-paste fix:** in a merge resolver, owning
nothing means every conflict SURFACES (fail-loud); in a DRIFT CHECK, owning nothing means nothing is
compared (fail-SILENT, indistinguishable from clean). ⇒ needs `exit 2` + `::error::`, not `return 1`.

**Contrast that localizes it:** the MISSING-file path is honest (`No …nv-main.txt on <ref> — cannot
determine ownership; skipping.`). Same epistemic state, opposite report. Direct instance of
[[feedback_a_guard_can_be_inert_and_read_as_passing]] — a check that cannot say "I couldn't evaluate."

**SEVERITY = LATENT, and measuring that mattered.** `nv-main` 5059 B; all 4 overlays
(`nv-dashboard`/`nv-slang`/`nv-slangpy`/`nv-nanoclaw`) have the file **ABSENT**, which routes to the
honest `skipping` path. ⛔**`wc -c` returns 0 for absent, empty, AND a bad ref — three states, one
number.** My first pass reported "bytes=0" on all four and I nearly published "live on every overlay";
`git cat-file -e` + `-s` discriminated. ⇒ **A zero from a size instrument is a THREE-WAY ambiguity.**

## ⛔ MY OWN INSTRUMENT FAILED TWICE — both caught only by controls

1. **Test B silently re-ran test A.** I committed the empty allowlist in `seed` but the script reads
   the **bare `origin.git`** I had cloned BEFORE that commit. Output was byte-identical to the
   baseline and read as "guard holds." Caught because I printed the byte count the script would
   actually read (15 = the OLD list, not 0). Fix: `git push` to the bare origin, re-fetch, **assert
   the ref's blob is 0 B AND that the drift is still in `git diff`** before believing the result.
   ⭐⭐⭐**A negative result from a fixture whose mutation never reached the read path is
   byte-identical to a real pass** — sibling of [[feedback_a_failed_cd_makes_the_next_grep_a_false_zero]].
2. **`exit=141` was SIGPIPE from `head`, not a script fault.** Re-ran redirecting to a file ⇒ exit 1.
   ⭐**Never attribute an exit code to the program while a pipe is truncating it.**

## 🟡 `check-ignore` unions with the repo's own `.gitignore`

`core.excludesFile` does NOT replace `.gitignore`, so ownership = union. Measured OWNED=YES for
`coworkers/foo.yaml`, `data/z.db`, `node_modules/**`, `slang_kb/**`, `AGENTS.md`, `*.zip`, `*.pid`,
`package-lock.json` — none in `nv-main.txt`. **Unreachable today:** exactly 4 tracked files match
`.gitignore` and all 4 are legitimately allowlisted (lines 59/166/168). Becomes live when a tracked
file is gitignored but not nv-main-owned ⇒ misreports as drift *in nv-main's name*. `--no-index` has
no flag to suppress `.gitignore`. **Same latent exposure in all 3 siblings** ⇒ suggested filing separately.

## ✅ Verified as claimed (ran it, didn't read it)

Never modifies tree (status/HEAD/stale content unchanged) · **deletions ARE reported** (the real
silent-revert shape) · **negation `!src/excluded.ts` honored** · allowlist read from `$REF` not
worktree (right, and `ci.yml:31` deliberately inverts to `OWNED_SRC=HEAD` for a nv-main PR so its own
allowlist edit applies to itself) · path-guard files skipped · **9/9 tests pass**, merge-train
baseline 5/5, `pnpm install --frozen-lockfile` clean, `tsc --noEmit` clean.

⚠️**`tsc` green is SCOPE-BLIND: `tsconfig.json` `include: ["src/**/*"]` ⇒ 315 files under `src/`, ZERO
under `setup/`.** The repo's own `typecheck` script is that command, so it's normal config — but it
says nothing about the PR's test file. Typechecked directly: clean. **Report the scope of a green.**

## 🟡 4 of 9 tests pass against a stubbed `exit 0`

Subagent stubbed the script → 5 fail / 4 pass. Tests 3,4,5,7 assert absence-or-green outcomes a no-op
satisfies; discriminating power is in 1,2,6,8,9. Test 7 (`NV_DRIFT_ALLOW`) asserts only `status===0`.
**No empty-allowlist test** — the one uncovered case is the one asserting an unjustified PASS.
⭐⭐**Stub-testing a suite for vacuity is cheap and found real weakness behind a 9/9 green.**

## Signal-to-noise (the finding that needed a discriminator, not a count)

Run unchanged on real `origin/nv-slang`: **358 files, exit 1.** Branch is 560 behind / 165 ahead,
nv-main NOT an ancestor. Compared each reported file to the **merge-base**: **122 byte-identical to
merge-base** (normal un-merged nv-main evolution, NOT stale copies) vs 236 genuine divergence.
⭐⭐⭐**"358 files differ" and "⅓ of them are not the thing this check exists to find" are both true;
only the second is a review finding.** Not a defect (documented default on an unmerged branch) but it
is the exact outcome the script's OWN path-guard comment warns about ("train the reader to ignore
output that matters"). Suggested: refuse when `git merge-base --is-ancestor "$REF" HEAD` is false, or
split the report.

**RESUME = author replies ⇒ the fix is ~3 lines + 1 test** (`[ -s "$OWNED_LIST" ] || exit 2` with
`::error::`; assert it). Nothing posted beyond the one comment; no auto-merge (maintainer-owned,
`nv-main` base). Series note: **5th consecutive PR where every defect is in the instrument/operator
surface and reading the diff finds none** — [[feedback_control_the_instrument_not_the_reasoning]].
