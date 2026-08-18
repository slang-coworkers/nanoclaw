---
title: "slang-rhi #787 texture-shared-cuda.vulkan flake is a missing-sync bug, not numeric tolerance"
type: learning
topic: slang-compiler
source: learnings/1784741714597-slang-rhi-787-texture-shared-cuda-vulkan-flake-is-.md
---

# slang-rhi #787 texture-shared-cuda.vulkan flake is a missing-sync bug, not numeric tolerance

**slang-rhi#787**: `texture-shared-cuda.vulkan` intermittently trips a `CHECK_GE(x >= expected - 0.01f)` tolerance assert, ONLY on windows-release-gpu-rhi (passes debug + every other platform), rerun clears it, PR-agnostic across 3 PRs. First read (my draft PR #791) framed it as a numeric near-miss and widened tolerance. Maintainer jhelferty-nv pushed back: "release-but-not-debug is suspicious — check for missing synchronization." He was right.

**Root cause (source-grounded @HEAD 1afb838):** The CUDA↔Vulkan shared-texture interop hand-off in `tests/test-texture-shared.cpp` relies SOLELY on a host-side producer wait `srcDevice->getQueue(Graphics)->waitOnHost()` (line 119). `getSharedHandle` (`vk-texture.cpp:64`) only exports the VkDeviceMemory handle; the CUDA import (`cuda-texture.cpp:548` cuImportExternalMemory + `:637` cuExternalMemoryGetMappedMipmappedArray) and readback (`cuda-device.cpp:525/538` cuMemcpy3D/cuMemcpy) do NO external-semaphore wait and NO `VK_QUEUE_FAMILY_EXTERNAL` ownership transfer. `cuWaitExternalSemaphoresAsync` is loaded but never called in production.

**Key discriminators that beat the tolerance framing:**
1. The shader (`trivial-copy.slang`) is a BIT-EXACT float4 copy of exactly-representable {0.0,0.5,1.0} in RGBA32Float — a synced run yields delta EXACTLY 0.0. No legit rounding source produces ~0.01. So tolerance MASKS, doesn't fix (and a stale/torn read can miss by far more than 0.01 anyway).
2. The sibling surface path (`cuda-surface.cpp`) already has the CORRECT machinery — exported Vulkan timeline semaphore imported into CUDA (`:636`), VK_QUEUE_FAMILY_EXTERNAL release/acquire barriers (`:847/1043/1107`), cuStreamSynchronize (`:992`; GPU-side CUDA→Vulkan signal `#if 0`'d at `:980`). Authors know the mechanism; the interop/test path just doesn't use it.
3. `test-buffer-shared.cpp:40` literally says `// TODO: Implement actual synchronization (and not this hacky solution)`.

**Method lessons:** (a) "release-but-not-debug + intermittent + rerun-clears + cross-API resource sharing" is a textbook missing-sync signature — investigate the sync path before widening a tolerance. A tolerance PR on a bit-exact comparison is almost always masking. (b) Grep the sibling/working path in the same backend — if it does careful cross-API sync and yours doesn't, that IS the gap. (c) DeepWiki surfaced the `test-buffer-shared.cpp` TODO fast. (d) Carry proven-vs-hypothesis honestly in the public verdict: bit-exact-copy + no-semaphore/no-ownership-transfer are PROVEN from source; the debug-masks-timing and ".vulkan-only fails" claims are HYPOTHESES until a failing CI log confirms them (Windows-GPU-only, unreproducible in a Linux container).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1784741714597-slang-rhi-787-texture-shared-cuda-vulkan-flake-is-.md`_
