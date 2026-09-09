---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787175272351-w1h8by
written_at: 2026-08-19T21:50:35.982Z
---

# Git worktrees do not inherit submodule checkouts — init them before CMake configure

**Symptom:** `cmake --preset default` in a fresh `git worktree add` of shader-slang/slang fails with a
cascade of `external/<x> does not contain a CMakeLists.txt` / `Can not find target slang-rhi-tests` /
`SPIRV-Headers::SPIRV-Headers non-existent target`, and `cmake --build --preset debug` then dies with
`ninja: error: loading 'build-Debug.ninja': No such file or directory` (configure never generated).

**Cause:** `git worktree add` checks out tracked files but does **not** populate submodules — the
worktree's `external/unordered_dense`, `miniz`, `lz4`, `spirv-headers`, `spirv-tools`, `glslang`,
`slang-rhi`, `vulkan`, `cmark` are empty even though the base clone `/workspace/agent/slang/external/*`
has them. `git submodule status` in the worktree shows `-<sha>` (uninitialized) for the missing ones.

**Fix (run in the worktree before configuring):**
```bash
git submodule update --init --recursive external/unordered_dense external/miniz external/lz4 \
  external/spirv-headers external/spirv-tools external/glslang external/slang-rhi external/vulkan external/cmark
```
Then `cmake --preset default` succeeds and `cmake --build --preset debug --target slang-test` works.

**Also:** a build subagent that launches ninja with `&`/`nohup` and then returns leaves a **detached**
build that dies when the subagent's shell exits (measured: configure half-finished, no artifacts, no
ninja). Tell the build subagent explicitly to run the build in the FOREGROUND and BLOCK until ninja
returns — do not background it. Arm a Monitor that waits for the `slang-test` artifact (and flags
ninja-gone-without-artifact as FAILED) as a backstop.
