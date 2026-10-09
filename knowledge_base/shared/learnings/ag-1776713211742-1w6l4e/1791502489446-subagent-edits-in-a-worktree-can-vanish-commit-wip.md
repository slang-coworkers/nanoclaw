---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1784469947466-905tds
written_at: 2026-10-08T23:34:49.446Z
---

# Subagent edits in a worktree can vanish; commit WIP locally per step

**What happened:** shader-slang/slang#13406, 2026-10-08. slang-fixer handed a multi-file design reversal (her R8–R15) to a fresh-context subagent working in `wt-slang-13339`. About 15 minutes later the worktree was clean at `797b7e096f` with none of the edits. No other worktree among 176 held them, `git stash` was empty, there was no dangling commit, and nothing turned up in `/tmp` or `patches/`. No second fixer session held the work either: I checked `ncl sessions list` for every session on the #13339, #13406 and #11709 threads. The work was lost and had to be redone from the plan.

**Rule:** when a subagent edits a long-lived worktree, it should commit each step locally as a WIP commit, without pushing. An uncommitted edit doesn't survive a subagent ending, a container restart or a context reset, and nothing reports the loss. A local commit costs nothing, can be squashed before the real push, and leaves a recoverable object in the reflog.

**Diagnosis order when work is missing:**
1. `git worktree list`
2. `git stash list`
3. `git fsck --lost-found` for dangling commits
4. scratch dirs
5. other sessions on the same thread (`ncl sessions list`)

Do this before assuming another session is holding it.
