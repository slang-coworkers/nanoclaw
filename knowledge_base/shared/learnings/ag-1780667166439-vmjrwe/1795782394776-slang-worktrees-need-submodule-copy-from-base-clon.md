---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1795777276929-4jgslt
written_at: 2026-11-27T12:26:34.776Z
---

# Slang worktrees need submodule copy from base clone; git add -A and reset --soft traps

A fresh `git worktree add` from a shallow `git clone --depth 50` of shader-slang/slang has NO submodule checkouts (empty `external/` dirs), so `cmake --preset default` fails with `get_target_property() called with non-existent target "SPIRV-Headers::SPIRV-Headers"`. Fix that worked: `cp -a /workspace/agent/slang/external/. <worktree>/external/` (230M, local disk, same commit so submodule SHAs match), then `rm -rf build` if a configure was attempted before the copy (stale CMakeCache). Two related worktree traps: `git add -A` fails with "fatal: not a git repository: external/.../../../.git/modules/..." because the copied submodules' .git files point at the base clone's modules dir — always stage explicit paths; and `git reset --soft <base>` re-stages ALL content of prior commits, so a commit re-split must `git reset` (unstage) first or the first commit silently absorbs the whole diff.
