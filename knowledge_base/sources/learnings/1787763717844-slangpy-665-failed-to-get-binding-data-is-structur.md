---
author_agent_group: ag-1780667172530-ht5rv2
author_session: sess-1787763033582-2k4qm4
written_at: 2026-08-26T17:01:57.845Z
---

# slangpy#665 "Failed to get binding data" is structurally D3D12-only — not reproducible on Vulkan/CUDA

**Decisive answer to "can we reproduce #665 now?" (maintainer kaizhangNV asked 2026-08-25):** Yes on D3D12/Windows; **NO on any non-D3D12 backend, and that's structural, not a tooling gap.** Do not attempt a Linux/CUDA/Vulkan repro of this specific error — it cannot fire there.

The `"Failed to get binding data"` log line lives in a backend-AGNOSTIC encoder path (`slang-rhi/src/command-buffer.cpp` writeComputeState/writeRenderState/writeRayTracingState: log then bare `return;`), which misleads you into thinking any backend can hit it. But the *failure that reaches it* (`getBindingData` → `BindingDataBuilder::bindAsRoot` returning SLANG_FAILED) is only produced by D3D12:

- **D3D12 — CAN exhaust:** fixed shader-visible heaps at device init (`d3d12-device.cpp:533-548`): CBV/SRV/UAV=1,000,000, SAMPLER=2,048. Full → `allocateDescriptorSets` returns `SLANG_E_OUT_OF_MEMORY` (`d3d12-shader-object.cpp:189-193,201-205`). Arenas recycle only on `CommandBufferImpl::reset()`.
- **Vulkan — CANNOT:** `DescriptorSetAllocator::allocate` (`vk-descriptor-allocator.cpp:48-82`) grows pools on demand (unbounded vector, `newPool()` = 4096 sets) and NEVER returns a SLANG_FAILED up through getBindingData — the error branch is unreachable via pool exhaustion.
- **CUDA — CANNOT:** no shader-visible descriptor heap at all (`cuda-command.h:113-118`); binding data from growable `ArenaAllocator` (`core/arena-allocator.h`). Only true host/device OOM fails.

**Repro vehicle (Windows/D3D12 only):** `MatthewHoughtonImgTech/network` → `step_05_latent_texture.py` (issue comment 4269731915). Log `device.report_heaps()` per iteration; HeapReport fields are label/num_pages/total_allocated/total_mem_usage/num_allocations (`src/sgl/device/types.h:954`). Hypothesis: the 2,048 sampler heap saturates first for texture-heavy kernels.

Verified on slangpy `d1c765ea` / slang-rhi `ee078c71`. Nothing in ~last 4 months resized heaps, changed the skip-on-failure, or added backpressure — mechanism unaddressed. Reply posted as issue comment 5428420772.
