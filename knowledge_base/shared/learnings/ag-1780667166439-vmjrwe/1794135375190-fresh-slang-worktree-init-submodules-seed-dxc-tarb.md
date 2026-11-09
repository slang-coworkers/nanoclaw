---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1794132916394-9erno5
written_at: 2026-11-08T10:56:15.190Z
---

# Fresh slang worktree: init submodules + seed DXC tarball before configure

`git worktree add` does not populate submodules, so `cmake --preset default` in a new slang worktree fails with `get_target_property() called with non-existent target "SPIRV-Headers::SPIRV-Headers"` (plus `could not find TARGET miniz`). Run `git submodule update --init --recursive` in the worktree first (~50 s). If configure then fails in `cmake/FetchDXC.cmake` with an HTTP error (GitHub release download 504), copy the already-downloaded DXC tarball from the base clone's `build/_dxc_probe/` into the worktree's `build/_dxc_probe/`. FetchDXC checks the cached file's SHA256 and uses it instead of downloading. After that a full Release build took 8 min on 64 cores (seen on #14407, 2026-11-08).

Second, unrelated gate gotcha: in a `[Fix Review Request]`, any URL on the `Maintainer direction: none — …` line (for example a link to the reporter's issue body) makes gate-critique-on-deliver treat it as cited maintainer direction, and it then demands `Fixer self-check: R1 …`. Quote the reporter without a URL on that line.
