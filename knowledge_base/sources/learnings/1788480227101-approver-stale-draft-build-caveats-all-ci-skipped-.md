---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1788479621007-3oyvwe
written_at: 2026-09-04T00:03:47.101Z
---

# [approver] Stale draft build caveats + all-CI-SKIPPED on large feature PRs (slang#12859)

**Context:** slang PR-approver, #12859 "Add experimental numeric interface modules" (MEMBER tangent-vector, +8672/-28, 40 files, new `source/standard-modules/numerics/` modules + tests + docs). Decision: ABSTAIN_POLICY (`CLAUSE_FAIL:no_protected_paths`; `tier_eligible` also failed) under bundled v0-shadow. Two transferable lessons independent of the abstain itself:

**1. Draft-era "won't build until #PREREQ lands" caveats go stale — re-verify on the pinned head, don't inherit the tasking's summary of the draft.**
- Symptom: the tasking (and the PR body *as originally opened* while draft) said the branch "is expected not to build until #12136 lands," naming #12830/#12857 as prerequisites, and targets `master` directly rather than stacking.
- Root cause: the branch was rebased between draft and ready-for-review. On the current head: #12830 was **MERGED** and the branch rebased onto it; the current body explicitly **retracts** the hard-dependency claim ("Neither #12857 nor #12136 is a hard dependency for this experimental module" — they're perf opportunities); #12591/#12857 turned out to be tracking *issues*, not PRs (they don't resolve via `gh pr view`).
- How to catch it: for any stacked/prerequisite-flagged PR, check (a) each named prerequisite's current `state`/`mergedAt`, (b) the PR's *current* body (not the draft summary), (c) `baseRefName` on the pinned head. A caveat from the draft is not evidence about the ready-for-review head.

**2. "CI green" isn't the only failure mode — the entire CI workflow can be SKIPPED, giving ZERO executed-build signal. Do not infer buildability from that.**
- Symptom: `eval-clauses.py` returned `ci_green_on_sha = unevaluable (combined status=pending)`. Digging further, the whole "CI" workflow *run* on the head (`gh run list --commit <sha>`) had conclusion **skipped** — every build-*/test-* check-run showed `skipped`, not `success`. The production "Claude PR Review" workflow was also `skipped` (harvest exit 22, CodeRabbit still pending).
- Root cause: legacy `/commits/{sha}/status` reads only commit *statuses* (CodeRabbit pending + license/cla) — blind to the skipped Actions check-runs; and the CI workflow evaluated its jobs' `if:`/path conditions to skip. Net: no compiler/test job actually ran on this head.
- How to catch it: when `ci_green_on_sha` is unevaluable/pending on a code PR, cross-check `gh run list --repo R --commit SHA` and `gh api repos/R/commits/SHA/check-runs`. All-`skipped` builds = the branch was never compiled by CI. Combined with the "reviewers check out master → phantom build-breaks on stacked PRs" prior, this is exactly where you must NOT trust the author's "builds locally / N tests pass" (untrusted body text) as a build signal. Flag the all-skipped CI to the human — a large new-module PR merging with no executed build/test is material regardless of the clause outcome.

**3. Class widening:** the v0-shadow `no_protected_paths` + `tier_eligible` deterministic abstain is not limited to `.github/**` CI-only PRs (#12888). A large **feature** PR that merely adds/edits a `CMakeLists.txt` (matches `**/CMakeLists.txt`) or exceeds the 400-line/30-file caps hits the same Step-1 early-return abstain. Expect it on any big standard-module/feature PR; the protected-CMake fail is a genuine policy guard, not a mount artifact.
