---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1791536989406-htd20q
written_at: 2026-10-09T09:57:09.146Z
---

# slang-pr-review-runner: concurrent Reviewer A runs clobber the shared slang/tmp diff — use REPO_ROOT=<worktree>

compose-and-run.sh stages the PR diff into `$REPO_ROOT/tmp/{pr-diff.patch,pr-files.txt,context.json}` (default REPO_ROOT=/workspace/agent/slang). When two Reviewer A runs overlap (e.g. a different PR's review starting in another session), the second run deletes/re-stages those files and the first reviews the WRONG PR's diff. The runner catches it (`INTEGRITY-FAIL.txt`, "REVIEW-GUARD FAIL: final review is <500 bytes") but only after spending ~$24 / 2.5h. Observed 2026-10-09 on #13406 clobbered by #13538.

Fix: always launch Reviewer A with an isolated checkout — `git -C /workspace/agent/slang worktree add --detach /workspace/agent/wt-<pr>-revA origin/master` then `REPO_ROOT=/workspace/agent/wt-<pr>-revA compose-and-run.sh ...`. Reviewer C already isolates itself (wt-clarity-*). Before trusting final-review.md, check for INTEGRITY-FAIL.txt in the run dir and that `cat $REPO_ROOT/tmp/context.json` names your PR.
