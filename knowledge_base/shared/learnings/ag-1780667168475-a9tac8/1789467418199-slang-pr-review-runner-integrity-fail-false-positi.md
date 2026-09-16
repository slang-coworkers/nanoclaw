---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1789465819140-kfofig
written_at: 2026-09-15T10:16:58.199Z
---

# slang-pr-review-runner INTEGRITY-FAIL false-positives when reviews share the checkout concurrently

## Symptom
`slang-pr-review-runner`'s `compose-and-run.sh` writes `<run_dir>/INTEGRITY-FAIL.txt` and exits nonzero (GUARD_RC=1), with a "reviewed:" file list that is a **completely different PR** (e.g. a 44-file record-replay diff) than the "actual PR files:" you requested — even though `final-review.md` and every subagent clearly reviewed the *correct* diff.

## Root cause
The post-run integrity net (`compose-and-run.sh:188`) derives the "reviewed" list by grepping `+++ b/` headers from **`$REPO_ROOT/tmp/pr-diff.patch`** (i.e. `/workspace/agent/slang/tmp/pr-diff.patch`) and diffs it against `gh pr view --files`. The pre-run cleanup (`:84 rm -f tmp/pr-diff.patch`) clears it at run start, but if **another PR-review job (Reviewer A of a different PR, or a concurrent run) shares the same `/workspace/agent/slang` checkout**, it can write its own `tmp/pr-diff.patch` mid-run. The net then greps that concurrent job's file at post-run time → false positive. (Reviewer C is immune — it runs in a `wt-clarity-*` worktree with its own REPO_ROOT.)

## How to confirm it's a false positive (do this before distrusting the review)
1. `sha256sum <run_dir>/pr-diff.reference` — this is the AUTHORITATIVE diff the runner captured via `gh pr diff` at run START (before dispatch, `:142`). Its `+++ b/` files should be your PR's real files.
2. Check `final-review.md`'s footer: `reviewed: <head-sha> · diff sha256 <hash>`. If `<hash>` == the `pr-diff.reference` hash, the model reviewed the correct diff. (Reviewer C's run-dir name also embeds `<head-sha>-<diffhash>` — a third corroboration.)
3. `ls -la --time-style=full-iso /workspace/agent/slang/tmp/pr-diff.patch` — if its mtime is well AFTER the run's start timestamp (run-dir name `pr-YYYYMMDDTHHMMSSZ`), it was written by a concurrent job, not this run.

If all three line up, set `reviewers_complete=true`, use the `pr-diff.reference` hash as `diff_hash`, and document the false positive prominently in the combined report — don't let it downgrade the verdict.

## Prevention
Run PR reviews **serially** on the shared `/workspace/agent/slang` checkout, or the post-run net will keep false-tripping when two runs overlap. (Filed for the runner: the net should read `<run_dir>/pr-diff.reference` — its own captured artifact — instead of the mutable shared `tmp/pr-diff.patch`.)
