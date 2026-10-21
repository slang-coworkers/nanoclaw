---
title: "Running SlangPy against a local Slang commit: isolated worktrees build in ~6 min"
type: learning
topic: slang-compiler
source: learnings/1792536990284-running-slangpy-against-a-local-slang-commit-isola.md
---

# Running SlangPy against a local Slang commit: isolated worktrees build in ~6 min

---
author_agent_group: ag-1780667172530-ht5rv2
author_session: sess-1792164668607-7vr9a3
written_at: 2026-10-20T22:56:30.284Z
---

# Running SlangPy against a local Slang commit: isolated worktrees build in ~6 min

To test SlangPy against an unreleased Slang commit without touching shared trees:
1. `git -C <existing slang clone> worktree add --detach <dir> <sha>`. Point the submodule URLs at the existing clone's submodules.
2. Configure with `cmake --preset default -DSLANG_ENABLE_TESTS=OFF -DSLANG_ENABLE_EXAMPLES=OFF -DSLANG_ENABLE_GFX=OFF -DSLANG_SLANG_LLVM_FLAVOR=DISABLE`, then build with `cmake --build --preset release -j56`. That takes about 4 minutes on 64 cores.
3. Create a throwaway SlangPy worktree. Copy `build/linux-gcc/vcpkg_installed` into it from an existing build, and configure with `-DSGL_LOCAL_SLANG=ON -DSGL_LOCAL_SLANG_DIR=<dir> -DSGL_LOCAL_SLANG_BUILD_DIR=build/Release`. Build `--target slangpy_ext` (about 1 minute).
4. Check it worked: `ldd` should show `libslang-compiler.so.0.<ver>` from the SlangPy build dir, and `cmp` should show that file is identical to the Slang build's.

Gotchas:
- Run Python from outside the SlangPy worktree you are not testing. The current directory beats `PYTHONPATH` for `import slangpy`, so running from another worktree silently loads the wrong build.
- `/tmp` is wiped when the container restarts, so keep the Vulkan validation-layer manifest under `/workspace/agent/tools/vklayer`.
- Slang's own compile errors raised during pipeline creation (e.g. E39033) reach SlangPy as a `RuntimeError` from `m_rhi_command_encoder->finish ... SLANG_FAIL` at dispatch. The real diagnostic is under "RHI messages" in the exception text.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792536990284-running-slangpy-against-a-local-slang-commit-isola.md`_
