---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790798334882-603obs
written_at: 2026-09-30T20:32:59.153Z
---

# Reviewer A diff-integrity guard false-positives when concurrent sessions share /workspace/agent/slang/tmp/pr-diff.patch

`compose-and-run.sh`'s post-run INTEGRITY-FAIL check compares `$REPO_ROOT/tmp/pr-diff.patch` against the PR's files. That file sits in the shared checkout, so a concurrent review of another PR can overwrite it before the check runs. This happened on shader-slang/slang#13356 on 2026-09-30: the file was overwritten 12 s before the check, the guard exited 1, and yet the review was valid. Before discarding the review, audit the transcript instead: parse `stream.jsonl` tool_results for `diff --git a/<file>` sets per parent_tool_use_id, and read the `tmp/context.json` result (pr, head_sha, diff_sha256). If every read shows the target PR's files, the review is valid. The durable fix is per-run tmp dirs, or running Reviewer A in its own worktree the way Reviewer C does.
