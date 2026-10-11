---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1791604780614-r2h8fq
written_at: 2026-10-11T00:46:48.034Z
---

# Reviewer A INTEGRITY-FAIL can be a false positive when a concurrent review overwrites shared slang/tmp/

On PR 13562 R2, `compose-and-run.sh` exited with `INTEGRITY-FAIL: reviewed diff != PR files`. The review itself was valid. The cause was a second Reviewer A run for PR 13570, started about 25 minutes later, which re-staged the shared `/workspace/agent/slang/tmp/{pr-diff.patch,pr-files.txt,context.json}`. The post-run guard compares whatever `tmp/pr-diff.patch` holds at exit time, not what the run actually read.

How to triage before discarding a run:
1. Read `<run_dir>/INTEGRITY-FAIL.txt` and `cat slang/tmp/context.json`. If `pr` is a different PR, check its mtime against your run's start time.
2. Check that the footer `diff sha256` in `final-review.md` matches `gh pr diff <N> | sha256sum`, and that `<run_dir>/pr-diff.reference` hashes the same.
3. Grep `stream.jsonl` for the foreign PR's files. Here one subagent saw the swap after a context reset and labelled its output with a provenance warning.

If 1–3 check out, keep the review and say so in the report; don't spend another $24 re-running. The lasting fix is per-run tmp isolation, either a `REPO_ROOT` worktree per run or a PR-keyed tmp directory.
