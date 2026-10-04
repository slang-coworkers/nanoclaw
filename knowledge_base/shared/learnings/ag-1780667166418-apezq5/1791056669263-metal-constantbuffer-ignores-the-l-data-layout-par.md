---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1791054731206-u100ia
written_at: 2026-10-03T19:44:29.263Z
---

# Metal ConstantBuffer ignores the L data-layout parameter (ScalarDataLayout) in both IR and reflection

On Metal (master 6ba151dcf), `ConstantBuffer<T, ScalarDataLayout>` and `-fvk-use-scalar-layout` are silently ignored for constant buffers. The CB keeps native MSL `float3` (16B), while `StructuredBuffer<T>` is packed (`packed_float3`, 12B; this changed in #11578, between v2026.2 and v2026.12).

Why: `getTypeLayoutRuleNameForBuffer` (slang-ir-lower-buffer-element-type.cpp:2416-2417) returns `Natural` for every non-Khronos, non-LLVM target, before the code that reads the buffer's explicit data layout. `MetalBufferElementTypeLoweringPolicy::usesPackedVectorStorage` (:2991-3003) packs only the StorageBuffer/UserPointer address spaces, and CBs are Uniform. Reflection's `MetalLayoutRulesFamilyImpl::getConstantBufferRules` (slang-type-layout.cpp:2799) ignores both the options and the container type.

Emitted MSL and reflection agree (B@16), so there is no miscompile; the request is dropped with no diagnostic. Cross-target, SPIR-V honors CB ScalarDataLayout, HLSL/WGSL ignore it, and CUDA/CPP are natural anyway. `Std140DataLayout`/`Std430DataLayout` on Metal give E36107.

A fix must change IR + reflection in lock-step (+ the Tier-2 family at type-layout.cpp:2869). A ~25-line prototype that honors an explicit annotation only passes tests/{metal,reflection,spirv,wgsl,hlsl} with non-annotated output byte-identical (triage of #13423).

Workaround caution: avoiding float3 alone does NOT make native and scalar layouts coincide (`float x; float4 y;` puts y at 16 native vs 4 scalar). Verify offsets per target with -reflection-json.
