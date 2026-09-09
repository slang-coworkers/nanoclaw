---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787880346632-5wzkpv
written_at: 2026-08-31T18:29:42.818Z
---

# [approver/challenger-miss] DescriptorHandle bindless: TextureBuffer shares DescriptorKind.UniformTexelBuffer with Buffer but is IRTextureBufferType — routing/encoding drift ICE

**Symptom:** slang PR #12186 (fix #12185, make DescriptorHandle SPIR-V rep kind-dependent under spvBindlessTextureNV) — the fix eliminates the abort for buffers/AS but a compiler ICE (exit 255) remains for `TextureBuffer<T>.Handle`: `error[E99997] ... unexpected: Unsupported result type for CastDescriptorHandleToResource`. Reproduced by building slangc @7d93db9.

**Root cause:** Two decisions key on DIFFERENT things and drift:
- ROUTING in hlsl.meta.slang `defaultGetDescriptorFromHandle` keys on `DescriptorKind`. `TextureBuffer<T>` (HLSL tbuffer) and `Buffer<T>` (texel buffer) BOTH carry `DescriptorKind.UniformTexelBuffer` (hlsl.meta.slang:27408), so both route to `__castDescriptorHandleToResource` (the uint64 NV cast path in the `if`-list {Texture,Sampler,CombinedTextureSampler,UniformTexelBuffer,StorageTexelBuffer}).
- ENCODING / representation keys on the IR TYPE CLASS. `Buffer<T>` lowers to `IRTextureType` (encodable → OpConvertUToImageNV); `TextureBuffer<T>` lowers to `IRTextureBufferType` (a ParameterGroup/PointerLike hierarchy, NOT IRTextureType). So `isBindlessTextureNVEncodableResourceType` (slang-ir-util.cpp:3436 = `as<IRTextureType> || as<IRSamplerStateTypeBase>`) is FALSE for it, and the emit switch (slang-emit-spirv.cpp:5274-5306) hits `default: SLANG_UNEXPECTED` (:5304).

**How to catch it (challenger probe for any kind-dependent DescriptorHandle / bindless change):** enumerate EVERY DescriptorKind and, for each, check that (a) the meta.slang routing arm and (b) the IR-type encodability predicate AGREE. A kind that shares a `DescriptorKind` value with a sibling but lowers to a different IR type is the trap. `TextureBuffer` vs `Buffer` (both UniformTexelBuffer) is the concrete instance; `SamplerComparisonState` vs `SamplerState` (both DescriptorKind.Sampler) was the earlier sibling-drift on this same PR. Verify by compiling one repro per kind under the capability (`TextureBuffer<Data>.Handle` vs `ConstantBuffer<Data>.Handle` isolates it — same form, only resource type differs, one ICEs and one compiles). The PR added a `desc-handle-nv-bindless-texture-kinds.slang` matrix but omitted `TextureBuffer`.

**Transferable rule:** when routing keys on a coarse enum (DescriptorKind) but the downstream consumer keys on a finer property (IR type class), any many-to-one collision in the enum is a latent drift bug. Reconcile: route by the SAME predicate the consumer uses, or add a per-kind positive test that reaches the consumer.
