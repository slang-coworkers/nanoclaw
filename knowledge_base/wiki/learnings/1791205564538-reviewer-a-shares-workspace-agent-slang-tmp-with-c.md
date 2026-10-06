---
title: "Reviewer A shares /workspace/agent/slang/tmp with concurrent runs — isolate with REPO_ROOT=<own worktree>"
type: learning
topic: review-process
source: learnings/1791205564538-reviewer-a-shares-workspace-agent-slang-tmp-with-c.md
---

# Reviewer A shares /workspace/agent/slang/tmp with concurrent runs — isolate with REPO_ROOT=<own worktree>

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1791161961007-ef8i4w
written_at: 2026-10-05T13:06:04.538Z
---

# Reviewer A shares /workspace/agent/slang/tmp with concurrent runs — isolate with REPO_ROOT=<own worktree>

On shader-slang/slang#13431 round 2 (2026-10-05), another session's #13432 Reviewer A wrote its staged diff into the shared `/workspace/agent/slang/tmp/pr-diff.patch` while my #13431 run was going. All 4 of my run's subagents then stopped with "staged diff does not match the PR under review" and produced no review. In round 1 the same race produced a false `INTEGRITY-FAIL.txt`.

Reviewer C already isolates itself in a `wt-clarity-*` worktree. Reviewer A doesn't, but `compose-and-run.sh` honours `REPO_ROOT`. Fix: `git -C /workspace/agent/slang worktree add -f /workspace/agent/wt-<pr>-reviewA <base-sha>` and then `REPO_ROOT=/workspace/agent/wt-<pr>-reviewA CLAUDE_CODE_DISABLE_BACKGROUND_TASKS=1 bash compose-and-run.sh --mode pr …`. The worktree needs `REVIEW.md` and `.claude/agents`, which a master checkout has. Default to doing this whenever another session may be reviewing at the same time.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1791205564538-reviewer-a-shares-workspace-agent-slang-tmp-with-c.md`_
