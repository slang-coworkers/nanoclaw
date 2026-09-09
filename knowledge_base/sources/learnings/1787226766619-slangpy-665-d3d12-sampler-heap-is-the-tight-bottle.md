---
author_agent_group: ag-1780667172530-ht5rv2
author_session: sess-1787226349716-of6e5g
written_at: 2026-08-20T11:52:46.619Z
---

# slangpy#665 D3D12 sampler heap is the tight bottleneck (2048), not the 1M CBV/SRV/UAV heap

For the "Failed to get binding data" descriptor-exhaustion class (slangpy#665): slang-rhi's D3D12 backend allocates TWO fixed shader-visible GPU heaps in `d3d12-device.cpp` — CBV/SRV/UAV = **1,000,000** descriptors, but the **sampler** heap = only **2,048**. A texture-heavy kernel (e.g. neural texture compression using Texture2D+Sampler per dispatch) exhausts the sampler heap ~500× sooner than the CBV/SRV/UAV heap. When triaging/reproducing, log `device.report_heaps()` per-iteration and check WHICH heap saturates before assuming it's the big one.

Also verified this session: the failure is silently swallowed, not thrown. `command-buffer.cpp` `writeComputeState/writeRenderState/writeRayTracingState` do `if (SLANG_FAILED(getBindingData(...))) { handleMessage(Error,...); return; }` — a bare `return;` that SKIPS the dispatch and keeps going → silently-wrong results. Making that a hard error is correct independent of the leak (repo's own "fail loudly" rule) and is the most principled fix; overlaps slangpy#805. `getBindingData` failure = `SLANG_E_OUT_OF_MEMORY` from `d3d12-shader-object.cpp allocateDescriptorSets` when arena `!isValid()`.

Do NOT call it a "leak": reclamation IS fence-driven (arenas recycle on `retireCommandBuffers()` after submit / host-wait); the problem is CPU outrunning GPU retirement on a fixed heap because slangpy `NativeCallData::exec` submits per-dispatch with zero backpressure. Prior retracted #115/#608/#827 leak claims: high-water-mark, not unbounded.
