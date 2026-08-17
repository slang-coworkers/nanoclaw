---
title: "[approver/human-agreement] BLOCK→WOULD_APPROVE flips clean when the fixer's next commit is a test-only, CI-proven-green fix of your exact next-action"
type: learning
topic: review-approval
source: learnings/1784270379814-approver-human-agreement-block-would-approve-flips.md
---

# [approver/human-agreement] BLOCK→WOULD_APPROVE flips clean when the fixer's next commit is a test-only, CI-proven-green fix of your exact next-action

## Symptom
I recorded a BLOCK (RED_BUG) on PR #11595 R4: the PR's new E41303 hard-error diagnostic broke a pre-existing untouched test (`tests/bugs/gh-9931.slang.1`, `Store<DescriptorHandle>(4,h,8)`, 4%8≠0 → hard compile fail on 3 aarch64 test-slang jobs). My next-action told the author to either fix the test's false alignment promise or reconsider the diagnostic. A later synchronize (R5) landed doing exactly that, and the orchestrator flagged it as targeting my finding.

## Root cause / what to verify on a "this fixes your BLOCK" revision
Do NOT rubber-stamp the flip on the orchestrator's word or the commit message. The disciplined re-eval that produced a confident BLOCK→WOULD_APPROVE:
1. **Scope the delta precisely.** `gh pr diff --name-only` + per-file hunk sha256 of R(n-1) vs R(n). Here: all 9 compiler source files were byte-identical R4→R5; only the test file changed. This is the load-bearing fact — it means the diagnostic (E41303) still stands and wasn't weakened to paper over the failure. A "fix" that silently relaxed the compiler would be a different (worse) decision.
2. **Trace the fix mechanism against real source, not the commit message.** The fix dropped a false `,8` promise: `Store<DescriptorHandle>(4,h,8)` → `Store(4,h)`. Verified against `hlsl.meta.slang`: the promise-less `Store<T>(uint,T)` overload forwards alignment 0 → `validateExplicitAlignment` early-returns (no E41303) → `isWideAccessAligned` with promise==0 trusts const offset only → scalarizes → compiles. Confirmed it's a *bad-test fix, not a masked bug*: offset 4 has no honest explicit-align spelling for an 8-byte type, so the promise-less scalarizing form is the correct spelling for the unaligned path the test exercises.
3. **The flip must be CI-proven, symmetric to the BLOCK.** A CI-proven BLOCK flips only on CI-proven green. WAIT for CI to settle at the new head; confirm the *specific* previously-red sub-test now passes (grep the job log for `passed test: '<the exact test>'`), not just an aggregate green. Here all 3 R4-red test-slang jobs went success and the macOS log showed `passed test: 'tests/bugs/gh-9931.slang.1'`.

## Calibration
A BLOCK whose next-action the author fixes exactly, with a CI-green test-only follow-up, is a VINDICATED BLOCK (SUPERSEDED_CHANGES_REQUESTED) — same shape as #12130/#11979. The within-session flip is the correct, honest outcome; recording WOULD_APPROVE here is not "backing down," it's the decision the new evidence supports.

## Meta-notes
- **REST survives when GraphQL 401s.** Post host-migration, `gh pr view` (GraphQL) returned HTTP 401 but `gh api` (REST) + WebFetch worked. Gather head/CI evidence via those rather than abstaining ABSTAIN_INFRA — the review signal was fully obtainable. (Confirms the #12109 lesson.)
- **Paginate check-runs.** `check-runs` defaults to 30/page; an unpaginated read undercounts. Use `?per_page=100` and read `total_count`. The OUTPUT_REVIEW critique caught me stating a wrong count from a partial page — always cite the paginated total.
- **Idempotent record survives a crashed turn.** My record turn errored (API 500) before writing; `record_decision` is keyed per (repo,pr,commit) so re-running after re-confirming head+CI is safe, not a duplicate.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784270379814-approver-human-agreement-block-would-approve-flips.md`_
