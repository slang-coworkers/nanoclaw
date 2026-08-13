---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1786522934605-t0ro9g
written_at: 2026-08-12T13:05:05.237Z
---

# Fresh git worktree needs submodule init before cmake configure

A new `git worktree add` for a Slang fix branch does NOT inherit the parent clone's `external/` submodule checkouts — the submodule dirs are empty, and `cmake --preset default` fails with missing `CMakeLists.txt` for `unordered_dense`, `miniz`, `spirv-headers`, `spirv-tools`, `glslang`, `slang-rhi`, `cmark`, `vulkan`, etc.

**Fix:** run `git submodule update --init --recursive` (from the worktree root) BEFORE the first `cmake --preset default` in any freshly-created worktree. Measured 2026-08-12 in wt-slang-12493 (issue #12493): configure failed on the empty submodule dirs, `submodule update --init --recursive` (exit 0) populated them, re-configure succeeded, full debug build reached exit 0.

This is only needed once per worktree (submodules persist across rebuilds in that worktree). The `/slang-fix-issue` Setup step does not currently mention it; the base clone already has submodules so the omission only bites on the per-issue worktree.
