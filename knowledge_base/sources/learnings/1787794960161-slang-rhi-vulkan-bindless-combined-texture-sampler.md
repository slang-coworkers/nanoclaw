---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787794739764-tsol6a
written_at: 2026-08-27T01:42:40.161Z
---

# slang-rhi Vulkan bindless combined-texture-sampler handle has no .y sampler-heap slot

Investigating shader-slang/slang#12784 (Vulkan combined texture+sampler bindless crash under multi-context).

Slang's SPIR-V emission for a combined texture+sampler accessed via a bindless `DescriptorHandle` (uint2) reads the TEXTURE from `ResourceHeapEXT[handle.x]` and the SAMPLER from a SEPARATE `SamplerHeapEXT[handle.y]`, then `OpSampledImage` (confirmed via DeepWiki: `processMakeCombinedTextureSamplerFromHandle` in slang-ir-spirv-legalize.cpp; `DescriptorHandle<T>` -> uint2). So a valid handle needs BOTH a resource-heap slot in `.x` AND a sampler-heap slot in `.y`.

slang-rhi's Vulkan backend does NOT match this model:
- `src/vulkan/vk-bindless-descriptor-set.cpp:286-318` `allocCombinedTextureSamplerHandle` writes a SINGLE `VK_DESCRIPTOR_TYPE_COMBINED_IMAGE_SAMPLER` into a dedicated third binding (`kCombinedImageSamplerBinding=1`) and sets `outHandle->value = slot` — the high 32 bits (`.y`) are left as 0 (uninitialized; `include/slang-rhi.h:647` `uint64_t value;` has no default). No separate SamplerHeapEXT slot is populated. There is NO ResourceHeapEXT/SamplerHeapEXT concept anywhere in `src/vulkan/` (grep: 0 hits).
- By contrast D3D12 (`src/d3d12/d3d12-texture.cpp:441`) composes `outHandle->value = textureHandle.value | (samplerHandle.value << 32)` — real texture SRV-heap slot in `.x`, real sampler-heap slot in `.y`, from two genuinely separate heaps (`m_srvUavAllocation` / `m_samplerAllocation` in d3d12-bindless-descriptor-set.cpp).

Consequence: on Vulkan, `handle.y` (the SamplerHeapEXT index Slang reads) is 0/garbage -> reads an unpopulated/aliased sampler-heap slot. This is a MODEL MISMATCH, not primarily a concurrency bug: there is no per-queue/per-context heap ownership, no heap-grow/realloc logic (fixed-capacity SlotAllocator, capacity from BindlessDesc), and no locking in the VK bindless set. The "only under a concurrent second context" symptom is likely because the sampler-heap slot 0 happens to be populated by chance in single-context and gets overwritten/differs when a second context is active — but the ROOT bug is that VK never populates a `.y` sampler-heap slot at all.
