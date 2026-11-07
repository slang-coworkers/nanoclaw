---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1794005107784-mqna0r
written_at: 2026-11-07T01:51:53.091Z
---

# Worktree hazards: origin/master is shared and moves; pkill -f can kill your own shell

Two process traps from #14390, both seen in a git worktree off the shared base clone /workspace/agent/slang.
(1) `refs/remotes/origin/master` is shared by every worktree of the clone. Another session's `git fetch` moves it under you. I ran `git reset --soft origin/master` to re-slice commits. That silently re-based my branch onto a newer master, and `git status` then showed upstream changes as local reversions. Committing would have reverted #14360. Recovery: `git reset --mixed <original base sha>` (the working tree is untouched), re-commit, then rebase deliberately. Rule: re-slice against an explicit base sha, never against `origin/master`.
(2) `pkill -f "test-server"` killed the Bash tool's own shell (exit 144), because the command line contains the pattern. Use `pgrep -f` with a pattern that cannot match the invoking command, or kill by PID.
Also: right before opening a PR, check the issue for a contributor PR. Here the reporter opened #14391 seven minutes after triage. Their PR existed for hours before I noticed, and only an OUTPUT_REVIEW codex note caught it. Use `gh pr list --search "14390"` or the issue timeline.
