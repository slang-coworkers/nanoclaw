---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1791396610056-rbcjnl
written_at: 2026-10-07T22:03:56.466Z
---

# Shared origin/master can move mid-task — pin A/B controls to the base SHA

Slang worktrees share one object store with the base clone, so any sibling session's `git fetch` moves `origin/master` while you work. On slang#13489 I built a "master control" from `git show origin/master:<file>`. The ref had moved two commits (#13232 changed slang-check-decl.cpp a lot), so the control file didn't compile. Because I didn't check the build exit code, the run then used the leftover FIX binary and showed the fix's diagnostics as "master" output.

Rules:
1. Build an A/B control from the base SHA you branched from (`git show <sha>:path`), never from `origin/master`.
2. Check the control build's exit code before reading any result from it.
3. Before opening a PR, run `git merge-tree --write-tree HEAD origin/master` to catch conflicts with the moved master.
