---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787809848898-1j1tx8
written_at: 2026-08-27T07:31:42.770Z
---

# slang-rhi build + backend-cache gotchas (issue 844)

From fixing shader-slang/slang-rhi#844 (ConstantBufferPool::reset() not freeing pages → unbounded retention).

**Build in a headless container needs GLFW off.** The `clang` CMake preset defaults `SLANG_RHI_BUILD_TESTS_WITH_GLFW=ON`; configure then dies on `Xinerama headers not found; install libxinerama development package`. Fix: `cmake --preset clang -DSLANG_RHI_BUILD_TESTS_WITH_GLFW=OFF -DSLANG_RHI_BUILD_EXAMPLES=OFF`. GLFW is only for surface/windowing tests; unit/compute tests don't need it. (Sibling worktrees were all configured this way.)

**Not every backend with a duplicated ConstantBufferPool has the leak.** The pool source is copy-pasted across d3d12/vulkan/d3d11/wgpu, but the *leak precondition* is queue-lifetime command-buffer caching. Only **D3D12 and Vulkan** have `CommandQueueImpl::m_commandBuffersPool` + call `CommandBufferImpl::reset()` (which calls `pool.reset()`) during retirement. **D3D11 and WGPU do NOT cache command buffers** — D3D11 news a fresh `CommandBufferImpl` per encode and hands it to the caller; `d3d11::CommandBufferImpl::reset()` never calls `pool.reset()`. So a free-on-reset change in D3D11/WGPU would be dead code, and they don't leak. Lesson: trace the *caller lifecycle* (who caches the object, who calls reset), don't assume all 5 duplicated copies need the same fix just because the triage memo lists them.

**Other slang-rhi divergences from the slang compiler repo:** default branch `main` (not master); CI (`ci.yml`) auto-runs on DRAFT PRs (no manual `gh workflow run`); formatting is `pre-commit` (`.pre-commit-config.yaml`), clang-format pinned **v20.1.7** + repo-local ascii hook `tools/check_ascii_hook.py` that auto-rewrites non-ASCII (em-dash → `-`) — keep source/comments ASCII. `pre-commit` not preinstalled: `pip install --break-system-packages pre-commit`, then `~/.local/bin/pre-commit run --files ...`. Tests are registered explicitly in root `CMakeLists.txt` `target_sources`, not globbed. Binary at `build/Debug/slang-rhi-tests` (Ninja Multi-Config).

**White-box test unwrap idiom:** `IDevice*` → concrete backend impl via `dynamic_cast<debug::DebugDevice*>(device)` then `->baseObject.get()` (works in both debug/release; RTTI is on). Precedent: `tests/test-cuda-external-devices.cpp`. Driving a pool directly, a `Page` holding `RefPtr<BufferImpl>` requires the full `BufferImpl` definition in scope (`#include "../src/vulkan/vk-buffer.h"`), else `~RefPtr`'s `static_cast<RefObject*>` fails to compile on the incomplete type.
