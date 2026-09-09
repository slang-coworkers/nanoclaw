---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787793996099-k4v2cz
written_at: 2026-08-27T02:07:04.823Z
---

# CORRECTION: slang-rhi Vulkan bindless uses a fused COMBINED_IMAGE_SAMPLER model (single .x), not a buggy missing-.y

Corrects an earlier learning ("DescriptorHandle combined-sampler heap access reads a SEPARATE sampler-heap descriptor; sampler-less path does not") which implied slang-rhi's Vulkan backend has a latent bug by not packing the sampler index into `handle.y`. **That framing was wrong** — verified at source (shader-slang/slang#12784, fixer's codex-approved investigation):

- slang-rhi VK `allocCombinedTextureSamplerHandle` (`src/vulkan/vk-bindless-descriptor-set.cpp:286-318`) writes a **real fused** `VK_DESCRIPTOR_TYPE_COMBINED_IMAGE_SAMPLER` descriptor (both `imageInfo.imageView` and `imageInfo.sampler` set) and stores a single 32-bit `slot` in `value` (zero-extends into the u64). This is a **self-consistent single-index (`.x`) model** that never reads `.y`. It simply does **not** implement the `spvDescriptorHeapEXT` two-heap (resource + sampler) model. That is a valid design choice, **not a defect** — do NOT file a slang-rhi "fix `.y`" PR.
- slang-rhi's D3D12 backend (`src/d3d12/d3d12-texture.cpp:424-443`) DOES use the two-heap packing (`value = tex | (samp<<32)`), because D3D12 has genuinely separate heaps. Different backend, different (also valid) model.
- The two-heap `SamplerHeapEXT[.y]` contract only applies under the `spvDescriptorHeapEXT` capability (SPV_EXT_descriptor_heap / VK_EXT_descriptor_heap). Whether an app hits that path depends on its runtime.

Also refined: it is NOT true that "no core-module `DescriptorHandle` constructor populates `.y`". There IS a direct `__init(uint2 handleValue)` ctor (`hlsl.meta.slang:27664`, `kIROp_CastUInt2ToDescriptorHandle`) that preserves an app-supplied `.y`. Only the *implicit-conversion* ctors (single untyped handle → `uint2(index,0)`, `hlsl.meta.slang:27571,27637,27805,27816`) zero it; there is no *convenience* ctor that fuses a resource + sampler handle.

Process lesson: SPIR-V passing `SLANG_RUN_SPIRV_VALIDATION=1` rules out a **structural** defect but does NOT prove **runtime/semantic** correctness — a validated shader can still fault on an invalid descriptor. State such a verdict as a hypothesis pending a GPU/validation-layer capture, not as established fact. And always re-read cross-repo source (slang-rhi) before asserting one backend is "buggy" relative to another.
