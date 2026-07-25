---
title: "Metal DescriptorHandle #10842: compiler-emit DONE, slang-rhi runtime is the gap; combined won't-fit is real (64b)"
type: learning
topic: slang-compiler
source: learnings/1784918108597-metal-descriptorhandle-10842-compiler-emit-done-sl.md
---

# Metal DescriptorHandle #10842: compiler-emit DONE, slang-rhi runtime is the gap; combined won't-fit is real (64b)

shader-slang/slang#10842 "DescriptorHandle support on Metal" is a **slang-rhi RUNTIME** gap, NOT a compiler gap. Two layers, easy to conflate:

- **Compiler/emit side = ALREADY DONE for Metal** @HEAD: `slang-emit-metal.cpp:148` unwraps `DescriptorHandle<T>` to T's native layout (bindless); `CastDescriptorHandleToUInt64` (:831); any-value marshalling bindless path. No compiler work needed.
- **RHI runtime side (slang-rhi) = the actual gap**: at HEAD (submodule pin 29dc332e / standalone main 1afb838) the Metal backend has **zero** `getDescriptorHandle` overrides — all inherit the `SLANG_E_NOT_AVAILABLE` base in `src/rhi-shared.cpp:74-88,239-248,275-284`. Metal advertises only `Feature::ArgumentBufferTier2` (`metal-device.cpp:246`), NOT `Feature::Bindless` (which Vulkan/D3D12/CUDA all add). `git log -S getDescriptorHandle -- src/metal/` over 200+ commits is EMPTY → never landed, not landed-then-reverted. Beware: a prior/closed tracker (#11540) claimed "buffer/texture/sampler Metal bindless was added" — that referred to the EMIT side; verify the RHI runtime empirically, don't trust the narrative.

**Combined-texture-sampler "doesn't fit in expected bits" is a REAL constraint, now grounded:** `DescriptorHandle::value` is a single `uint64_t` (`include/slang-rhi.h:647`). Metal combined = texture `gpuResourceID` (64b) + sampler `gpuResourceID` (64b) = 128b → can't fit one uint64. D3D12 fits combined ONLY because its handles are 32-bit heap indices packed 2-into-64 (`d3d12-texture.cpp:442` `tex.value | (sampler.value<<32)`); Metal IDs are full 64-bit so the trick fails. Separate buffer/texture/sampler each = one 64-bit native id (`MTLBuffer.gpuAddress` / `MTLTexture.gpuResourceID` / `MTLSamplerState.gpuResourceID`, already written to arg buffers) → fit fine, feasible. Maintainer (jhelferty-nv) closed combined as won't-do (#11540) and asked to triage the rest toward a fix.

**Fix shape (slang-rhi PR):** new `metal-bindless-descriptor-set.{h,cpp}`, `addFeature(Feature::Bindless)` gated on ArgumentBufferTier2, getDescriptorHandle on Metal buffer/texture/sampler returning the RAW native 64-bit id (Metal arg-buffer model stores the id directly — NOT a Vulkan/D3D12-style allocated heap index), enable Metal only in bindless-buffers/-textures/-samplers of `tests/test-bindless.cpp` (leave combined masked to D3D12|Vulkan|CUDA). GPU/macOS-only runtime → not Linux-testable; relies on macOS CI. Confirm the host handle-value contract matches the emit/arg-buffer consumer before landing.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1784918108597-metal-descriptorhandle-10842-compiler-emit-done-sl.md`_
