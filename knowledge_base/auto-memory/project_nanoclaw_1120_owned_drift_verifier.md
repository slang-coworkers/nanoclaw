---
name: project_nanoclaw_1120_owned_drift_verifier
description: "nanoclaw#1120 owned-drift verifier fail-closed + pathspec ownership — MERGED 3min after opening; a CONCURRENT session posted BOTH my findings 20min before me with better evidence; I published only the additive delta (fixture cost of the fix + #1134 superseding). Inline routing, ~27th instance."
metadata:
  node_type: memory
  type: project
  originSessionId: gh-issue-slang-coworkers/nanoclaw-1120
---

**slang-coworkers/nanoclaw#1120** — `owned-drift verifier: fail closed, and resolve ownership the way
CI does`, author **`szihs` (human)**, base `nv-main`, branch `fix/nv-main/owned-drift-verifier`,
head `70091b05`. 5 files +256/−33. Follow-up to **my own #1083 finding** (empty allowlist ⇒
`ok: no drift` + exit 0). Split out of #1112 on revert profile; sibling = #1119.

**ROUTING: handled INLINE by Main (~27th instance)** — NanoClaw platform-infra fork, never to a
`*-pr-approver`. The `pr_ready_for_review` webhook carried the generic *"Route it to the project's
`*-pr-approver`"* task string; standing rule overrides. See
[[project_nanoclaw_pr874_webhook_route_approver]], [[project_nanoclaw_1083_drift_check_empty_allowlist]].

**MERGED `f03cff94` at 13:41:49Z — 3min12s after opening (merge-race count now EIGHT+).** All 3
checks green (`check`/`ci`/`label`). 0 comments and 0 reviews when I began.

## ⛔⭐⭐⭐ THE REAL LESSON: a concurrent session posted BOTH my findings, 20 min before me

`nv-slang-bot` comment `5205786228` @ **14:09:03Z** (routed from the closed #1112) carries
**finding 1 = the `pathspec`-less failure** and **finding 2 = the worktree-sourced matcher**,
including the **identical one-line fix** (`MATCHER="$WORK/ownership.py"` + `git show "$REF:…"`)
verified with the same both-direction controls. I checked `slang-nanoclaw-chains-index` at the START
and the comment **did not exist yet** ⇒ genuine concurrent race, not a skipped check. See
[[project_nanoclaw_1088_sendmessage_collision]] (same failure mode, 2nd occurrence).

⭐⭐⭐**Its finding 1 is BETTER than mine and the difference is scope, not effort.** I measured
"6 of 13 drift tests fail without `pathspec`" and attributed it to *environment* (my container's
`python3` lacks the module) — correct measurement, wrong owner. It localized the cause: `Host tests`
**also runs in `compose-check.yml`**, which has **zero** `setup-python`/`pathspec` lines, so the
failure is CI's, live on `nv-main` since this PR's own merge commit. ⇒ **I never enumerated the
workflows that run the affected test.** A per-file census (`grep -l "vitest run" .github/workflows/`)
would have cost one command and turned my env-caveat into the finding.

⇒ ⭐⭐⭐**"This failure is my environment" is a CLAIM ABOUT WHERE THE TEST RUNS, and it needs the
same enumeration as any other scope claim — list every runner of the test before writing it off.**
Direct sibling of the rule that a fact recruited as a caveat gets spent rather than examined
([[project_nanoclaw_1084_derived_hardened_image]]).

## ✅ What I published — the additive delta only (comment `5206125463`)

⭐⭐**Refused to restate the sibling's two findings** (my own #1103 lesson: a full restatement of a
standing finding is noise). Posted two things it did not cover:

**1. 🟡 The agreed one-line fix turns 6 of 13 tests RED, and the cause is the FIXTURE.** Anyone
implementing it sees `expected 2 to be +0` ×4 plus 2 more and could reasonably back the fix out as
wrong. **TWO independent fixture assumptions, both marked deliberate at
`setup/nv-owned-drift.test.ts:93-96`** (*"Left untracked on purpose"*): (a) the seed's `nv-main`
branch never commits `ownership.py` ⇒ `git show "$REF:…"` finds nothing ⇒ exit 2; (b) the untracked
worktree copy then **blocks** `git checkout -B tmp-nv-main origin/nv-main` (*"untracked working tree
files would be overwritten"*) once the ref does carry one. Both correct for a worktree-sourced
matcher, wrong for a ref-sourced one. **Two fixture lines ⇒ `13 passed (13)`**, and the adapted
suite is NOT weaker — measured on a real `nv-main` clone with a committed stale `src/router.ts` AND
a neutered matcher, one variable: tip script → **exit 0 `ok: no nv-main-owned file differs`**;
patched → **exit 1 reporting `src/router.ts`**.

⇒ ⭐⭐⭐**A fix everyone agrees on still needs its COST measured — "correct" and "lands green" are
different claims, and the gap between them is where a correct fix gets reverted.** The sibling
proposed the exact patch and never ran the suite against it.

**2. 🟡 Finding 1 was already resolved at tip, by a DIFFERENT mechanism than the one recommended.**
`#1134` merged **14:16Z (7 min after that comment)** and did *not* add the steps to
`compose-check.yml` — that file still has **0** `pathspec`/`setup-python` lines at tip `8d108b2f`.
`ownership.py` now self-provisions a cached venv on `ModuleNotFoundError`. ⭐⭐**#1134's own framing
is the durable part: `ci.yml` is the ONE nv-main-owned file that cannot compose itself** (Actions
has already read the workflow before the compose step runs), so *"adding a CI step on `nv-main` is
not equivalent to adding a file on `nv-main`"* — provisioning inside the module reaches every
consumer, a workflow step reaches only its own workflow. **Verified at tip, cold cache
(`rm -rf ~/.cache/nv-path-guard`), system `python3` without `pathspec`: drift suite `13 passed`,
venv created, and the POSITIVE CONTROL FIRED** (committed stale `src/router.ts` → exit 1 naming it)
⇒ the 13-pass is a real answer, not a silently-skipped matcher. **The two fixes compose**: with the
ref-read patch at tip, tampered → 1, intact → 1, clean `nv-main` → 0.

## ✅ Premise verified independently, and the tracked tree could not show it

The PR's ambient-ignore claim is real, but **on today's tracked tree the two engines agree exactly**:
992 tracked paths, **`git check-ignore` + ambient = 967, `pathspec` allowlist-only = 967, both
difference sets EMPTY.** ⇒ ⭐⭐⭐**a divergence that is zero on the tracked tree is not absent — the
whole point is that ambient `.gitignore` rules match paths git does not track.** Reproduced
end-to-end instead: `.mcp.json` (present on `nv-main`, **not** allowlist-owned), staled on a composed
`nv-slang` overlay + one `.gitignore` line ⇒ **old script reports it as nv-main-owned drift, new one
does not** (`comm` isolates exactly `.mcp.json`). On hypothetical/ignored paths the divergence is
**11 of 13 probes** (`data/v2.db`, `dist/index.js`, `groups/main/notes.txt`, `node_modules/**`, …).
⭐⭐**Also found the INVERSE direction, unmentioned by either the PR or the sibling: an ambient
NEGATION can UN-own an allowlisted path** — `.gitignore` `!src/owned.ts` with allowlist `src/**` ⇒
git says NOT-owned, `pathspec` says owned; same for `.git/info/exclude`. The repo has 3 real
negation lines (`!groups/templates/`, 2× `!container/claude-trace/…dist/`); **0 tracked paths
affected today**, and the 3 surviving `check-ignore` readers (`ci.yml:64`, `setup.sh:203`,
`merge-train.sh:46`) still carry it. Not published — latent, and the sibling's live findings matter more.

## ✅ Verification (each with the control that made it real)

- **Non-inertness by impl-swap**: pre-change script + committed tests ⇒ **5 fail** (exactly the 5 new
  `it()`s: 9→13). Post-change ⇒ `13 passed`.
- **Merged blobs == reviewed head BY HASH**: 4 of 5 identical; only `.github/workflows/ci.yml`
  differs, because **#1118 (F01) later added a step**. The `pathspec` install **survives at tip in the
  claimed order** (release-age assert → `pnpm install` → `setup-python` → `pip install pathspec` →
  `Host tests`) ⇒ **the PR's own `git merge-tree` no-conflict claim HELD**.
- **Full host suite at head**: `2048 passed | 3 skipped`, **1 failed FILE** =
  `Cannot find module './dashboard.js'` — **MY ENV, proven by the identical failure at merge-base
  `e81a0cc7`**; `dashboard.js` is skill-installed, tracked at neither rev (the known "N files /
  0 tests" import-error signature).
- **`check.py`'s refactor is behaviour-preserving**: `ok: all 5 changed file(s) match nv-main's
  allowlist` at head; and its `pathspec`-absent path **improved** — base raised a bare
  `ModuleNotFoundError` **rc=1**, head prints an actionable `::error::` + install hint at **rc=2**.
- **`git merge-base` for the diff, never `baseRefOid`**: two-dot showed **28 files / 410+/1889−**, the
  true merge-base diff is **5 files / 256+/33−**.

## 🟡 Not charged: the empty-allowlist policy still diverges, and it is PRE-EXISTING

After this PR, `check.py` is the **only** consumer that greens on an unusable allowlist
(`::warning:: … skipping`, **return 0**) while the drift verifier and `ownership.py`'s CLI both
**exit 2**, and `ci.yml`/`setup.sh`/`merge-train.sh` use `[ -s ] || return 1` (own nothing ⇒ all
conflicts surface). **Byte-identical at base ⇒ not this PR's regression**, and defensible for a
required check that must not block every PR on config absence. Unreachable today (all 5
`<branch>.txt` carry 3–114 patterns). The sibling comment covers it as a docstring note.
⭐**The PR body's *"One implementation, so the verifier and CI cannot drift"* is true of MATCHING and
false of the SKIP POLICY — check which axis a parity claim actually covers.**

## ⛔ MY OWN INSTRUMENT FAILURES — 3, all caught by controls, one a FALSE PASS

1. ⭐⭐⭐**My hand-rolled harness produced a PASS that was pure artifact.** `NEW3 comments-only
   allowlist -> rc2 (=2)` — the 2 came from **`::error:: not a git repo`**, because a `set -e` +
   unbound-variable cascade had destroyed the fixture before the script ran. **A test asserting only
   an EXIT CODE cannot distinguish the path it means from every other path that exits the same way.**
   Abandoned the harness for the repo's real vitest suite (`pnpm install --frozen-lockfile` first).
   ⇒ **assert on the MESSAGE as well as the code**, and treat a passing hand-rolled fixture with
   more suspicion than a failing one.
2. **`ModuleNotFoundError: pathspec`** would have made every probe a meaningless exit-1 (3rd instance
   of this exact shape in this repo — #1084, #1103). Built a venv **first**, then confirmed the
   matcher fires (`src/foo.ts`,`docs/x.md` owned / `groups/main/notes.txt` not) before any claim.
3. **Per-file `python3` spawn × 992 timed out at 2min**; batching via the CLI's stdin + `check-ignore
   --stdin` made it instant. A timeout is not a result.
4. ⚠️**`--reporter=basic` is not a valid vitest 4.1.4 reporter** — it crashes at startup
   (`Failed to load custom Reporter from basic`), which reads exactly like a broken suite. Drop the flag.
5. ⚠️**A `git clone` of a local repo + `git checkout <sha>` prints the DETACHED-HEAD advice naming
   the sha you left, not the one you are on** — I nearly recorded the wrong baseline; `git rev-parse
   --short HEAD` is the authority.
6. ⚠️`/workspace/extra/ephemeral` is **read-only** (recorded before; re-confirmed). Worked in `/tmp`.

RESUME = the 2 fixture lines are an unowed offer (the fix itself is the sibling's finding, and #1134
already resolved the more urgent half). Merged, so nothing live to gate. **On redelivery: state is
MERGED at `f03cff94`, 2 comments exist (`5205786228` sibling + `5206125463` mine) — do NOT re-review.**
