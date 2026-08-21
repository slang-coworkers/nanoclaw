---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1787222144460-qmu0cr
written_at: 2026-08-20T22:49:05.358Z
---

# Reviewer A INTEGRITY-FAIL can be a teardown-time false alarm under concurrent runs

**Context:** slang-pr-review-runner's `compose-and-run.sh` has a diff-integrity NET at teardown (lines ~185-195): if `$REPO_ROOT/tmp/pr-diff.patch` exists, it greps that file's `+++ b/` paths and compares to `gh pr view <PR> --json files`. Mismatch → logs `!!! INTEGRITY-FAIL: reviewed diff != PR N files — review targeted the WRONG diff` and writes `INTEGRITY-FAIL.txt`.

**The false-alarm mechanism:** `/workspace/agent/slang` is a SHARED mutable checkout. When multiple reviews run concurrently (A for PR X, plus other PRs), they all write the same `tmp/pr-diff.patch`. The net re-reads that file at A's *exit*, by which time a LATER concurrent run has clobbered it with a THIRD PR's files. So `INTEGRITY-FAIL.txt` can show reviewed-files that belong to neither the PR under review nor even the run that raced it. The claude model itself often detects the mid-run clobber and re-fetches a sha256-verified copy — its `final-review.md` process-note says so.

**How to adjudicate (do NOT re-run on the log line alone; do NOT trust the model's self-report alone):** triangulate the diff sha256 across FOUR independent sources that agree only if A reviewed the right diff:
1. `sha256sum <(gh pr diff <PR> -R <repo>)` recomputed live
2. `sha256sum <run_dir_A>/pr-diff.reference` (A's run-START snapshot, written before the model ran)
3. the `diff sha256 <prefix>` in `final-review.md`'s footer
4. the diff-hash embedded in Reviewer C's independently-named run dir (`pr-...-<headsha>-<diffhash>-...`)
Then positive-control ONE finding: confirm its cited file:line exists in the live PR diff. If all four hashes match and the content maps, the review is VALID — the INTEGRITY-FAIL is a shared-`tmp/` teardown artifact, not a wrong-diff.

Real example: PR 12647 — INTEGRITY-FAIL.txt listed `slang-diagnostics.lua`/`slang-parameter-binding.cpp`/`shader-record-global-cuda.slang` (a different PR), on-disk `tmp/pr-diff.patch` at teardown held a THIRD PR (`glsl-legalize.cpp`), yet all four sha256 sources agreed on `7bd29aebe45b…` and A's findings mapped exactly to 12647's 4 files. Valid review.

**Prevention (for the skill owner):** run each concurrent review in its own git worktree or a private TMPDIR so `tmp/pr-diff.patch` isn't shared. Until then, the net will keep firing false positives whenever reviews overlap. Related: [[integrity-fail-guard-dismissal-hazard]], [[a-byte-count-is-not-artifact-identity]].
