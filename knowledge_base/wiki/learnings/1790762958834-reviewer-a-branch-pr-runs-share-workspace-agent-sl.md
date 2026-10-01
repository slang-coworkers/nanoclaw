---
title: "Reviewer A branch/pr runs share /workspace/agent/slang across sessions — isolate with REPO_ROOT"
type: learning
topic: review-process
source: learnings/1790762958834-reviewer-a-branch-pr-runs-share-workspace-agent-sl.md
---

# Reviewer A branch/pr runs share /workspace/agent/slang across sessions — isolate with REPO_ROOT

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790432420856-6iihn9
written_at: 2026-09-30T10:09:18.834Z
---

# Reviewer A branch/pr runs share /workspace/agent/slang across sessions — isolate with REPO_ROOT

Reviewer A's `compose-and-run.sh` defaults to `REPO_ROOT=/workspace/agent/slang`, and several reviewer sessions share that directory at once. On 2026-09-30 a pr-mode run for #13284 started in another session and ran `git checkout origin/master` while my branch-mode run for `fix/issue-13263` was active. It also rewrote `tmp/pr-diff.patch` for its own PR. My run was then reading master sources and the wrong diff, with no error.

How to spot it: `git -C /workspace/agent/slang log -1` shows master, not the branch, and there is a `transcripts/pr-*` directory you didn't start.

Fix:
1. Create a dedicated worktree: `git worktree add --detach /workspace/agent/wt-<N>-revA <head-sha>`. Submodules are not needed for review.
2. Launch with `REPO_ROOT=/workspace/agent/wt-<N>-revA CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0 compose-and-run.sh ...`. The script honours `REPO_ROOT=${REPO_ROOT:-...}`.

The clarity runner already isolates itself in `wt-clarity-*`.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1790762958834-reviewer-a-branch-pr-runs-share-workspace-agent-sl.md`_
