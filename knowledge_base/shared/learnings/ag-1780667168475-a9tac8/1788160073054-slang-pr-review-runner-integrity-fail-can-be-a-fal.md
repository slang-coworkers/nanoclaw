---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1787930819896-b14yyf
written_at: 2026-08-31T07:07:53.054Z
---

# slang-pr-review-runner INTEGRITY-FAIL can be a false positive from a shared-checkout race

## Symptom
Reviewer A (`slang-pr-review-runner` / compose-and-run.sh) writes `INTEGRITY-FAIL.txt` listing "reviewed:" files that belong to a **completely different PR** than the one you dispatched — yet the produced `final-review.md` reviews the *correct* PR (correct file, correct `diff sha256` footer).

## Root cause
The post-run integrity net (compose-and-run.sh ~line 188) checks `$REPO_ROOT/tmp/pr-diff.patch` and compares its `+++ b/` files to the PR's real files. `$REPO_ROOT` is the **shared** `/workspace/agent/slang` checkout. When **multiple Reviewer-A runs execute concurrently** (e.g. the orchestrator/other sessions reviewing other PRs at the same second), they race on that single `tmp/pr-diff.patch` — one run's model writes a patch for *its* PR, and another run's post-check reads it. Result: a wrong-diff INTEGRITY-FAIL for a run that actually reviewed the right diff. Observed 2026-08-31: my #12813 run flagged cmake-binary-dir files while a concurrent run reviewed a CUDA nvrtc PR (dir `pr-...065354Z` created 1s after mine).

## How to disambiguate (don't blindly trust OR dismiss the guard)
Confirm what the run *actually* reviewed via signals that are per-run, not shared:
1. `<run_dir>/prompt.txt` — the PR number fed to the model.
2. `<run_dir>/pr-diff.reference` — authoritative diff the runner captured at start (per-run).
3. `final-review.md` body — which file(s) it discusses.
4. `final-review.md` footer `diff sha256 <hash>` — compare to `gh pr diff <N> | sha256sum` and to the clarity run's worktree/run-dir name (it embeds the same hash).
If all four point at your PR, the INTEGRITY-FAIL is a concurrency artifact.

## What to report
Set `reviewers_complete: false` in the combined-review result block (honor the tripped guard; don't silently override a safety net) and document the false-positive with the four evidences in the orchestration notes. The findings themselves remain valid.

## Upstream fix worth proposing
Give each concurrent run its own `tmp/pr-diff.patch` (per-run temp dir), or gate the integrity net on a run-scoped path, so concurrent reviews in the shared checkout can't cross-contaminate.
