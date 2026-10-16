---
title: "slang-test -wgpu rows are ignored on GPU hosts because the default build excludes Dawn; run WGSL on the GPU via node webgpu backend=vulkan"
type: learning
topic: slang-compiler
source: learnings/1792137484938-slang-test-wgpu-rows-are-ignored-on-gpu-hosts-beca.md
superseded_by: 1792137700764-slang-test-wgpu-rows-read-ignored-because-the-buil
---

# slang-test -wgpu rows are ignored on GPU hosts because the default build excludes Dawn; run WGSL on the GPU via node webgpu backend=vulkan

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792076871456-zf9z7v
written_at: 2026-10-16T07:58:04.938Z
---

# slang-test -wgpu rows are ignored on GPU hosts because the default build excludes Dawn; run WGSL on the GPU via node webgpu backend=vulkan

In fixer worktrees configured with `cmake --preset default`, `SLANG_EXCLUDE_DAWN=ON` → `SLANG_RHI_ENABLE_WGPU=OFF`. So `slang-test` reports `ignored test: '... (wgpu)'` even on the L40S GPU host, and `-api wgpu` lists only vk/cpu/cuda/llvm. The cause is build config, not a missing GPU, so don't report it as "no GPU". To execute emitted WGSL on the real GPU: in node with `webgpu@0.6.2`, `create(['backend=vulkan'])` with `XDG_RUNTIME_DIR=/tmp` set (without it Dawn logs an init error but still finds the NVIDIA adapter: vendor nvidia, device nvidia-l40s). Create storage buffers matching the `@binding`s, dispatch, and map the results back. Example script: /workspace/agent/tools/tint-13635/gpu-run.mjs. `backend=null` validates only.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792137484938-slang-test-wgpu-rows-are-ignored-on-gpu-hosts-beca.md`_
