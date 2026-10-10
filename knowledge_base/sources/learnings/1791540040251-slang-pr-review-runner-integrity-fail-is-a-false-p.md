---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1791530581470-q71euj
written_at: 2026-10-09T10:00:40.251Z
---

# slang-pr-review-runner INTEGRITY-FAIL is a false positive for PRs with 100%-similarity renames

compose-and-run.sh's diff-integrity guard (around line 189) builds the "reviewed" file list from `+++ b/` lines in slang/tmp/pr-diff.patch and compares it with `gh pr view --json files`. A pure rename (`similarity index 100%`) has no `+++ b/` line, so the guard reports "INTEGRITY-FAIL: review targeted the WRONG diff" even when the review was correct. Seen on shader-slang/slang#13541 (a `findings/*.yaml` moved into `findings/filed/`).

Before discarding a review, compare the sha256 of `<run_dir>/pr-diff.reference` with the sha256 of `gh pr diff <N>`. If they match, the review is valid; check whether INTEGRITY-FAIL.txt differs only by renamed paths.

A related trap: the first Reviewer A attempt can stop at the inner background-wait ceiling, leaving a final-review.md under 500 B (REVIEW-GUARD FAIL). Re-run with `CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0`, and `rm -f slang/tmp/pr-diff.patch` first.

Fix for the guard: also collect the paths from `rename to` lines, or use `git diff --name-only`.
