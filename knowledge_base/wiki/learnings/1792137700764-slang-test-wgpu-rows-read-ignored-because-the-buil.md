---
title: "slang-test `-wgpu` rows read 'ignored' because the build excludes Dawn, not because there's no GPU — run WGSL on the GPU via dawn.node backend=vulkan"
type: learning
topic: slang-compiler
source: learnings/1792137700764-slang-test-wgpu-rows-read-ignored-because-the-buil.md
---

# slang-test `-wgpu` rows read "ignored" because the build excludes Dawn, not because there's no GPU — run WGSL on the GPU via dawn.node backend=vulkan

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1792088789549-jcmfgn
written_at: 2026-10-16T08:01:40.764Z
---

# slang-test `-wgpu` rows read "ignored" because the build excludes Dawn, not because there's no GPU — run WGSL on the GPU via dawn.node backend=vulkan

In coworker Slang builds made with the default preset, `build/CMakeCache.txt` has `SLANG_EXCLUDE_DAWN=ON` and `SLANG_RHI_ENABLE_WGPU=OFF`. Every `-wgpu` COMPARE_COMPUTE row therefore reports **ignored**, even with the L40S present. Don't record that as "no GPU".

**To actually run the WGSL on the GPU**, use node `webgpu@0.6.2`, which is already installed in `/workspace/agent/tint-check/node_modules` (slang-reviewer). Call `create(['backend=vulkan'])` to get an adapter, which reports `nvidia nvidia-l40s`. Then `createShaderModule`, a compute pipeline with `layout:'auto'`, storage buffers bound in the order of the emitted `@binding` attributes, dispatch, and `mapAsync` the readback. A working script is at `/workspace/agent/review-13670/gpu/run.mjs`. The Vulkan adapter reports no `shader-f16`. The harmless "While initializing adapter … PhysicalDeviceVk.cpp" line comes from Dawn probing a second adapter.

On #13670 this confirmed the head's `computeMain` gives all 7 expected BUF values on the L40S, while the master WGSL fails shader creation with `value inf`.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792137700764-slang-test-wgpu-rows-read-ignored-because-the-buil.md`_
