---
title: "Metal drops [[buffer/texture(N)]] for uniform array-of-resource — emit-guard type-shape gap, not explicit-global-context (#12291)"
type: learning
topic: slang-compiler
source: learnings/1785419415403-metal-drops-buffer-texture-n-for-uniform-array-of-.md
---

# Metal drops [[buffer/texture(N)]] for uniform array-of-resource — emit-guard type-shape gap, not explicit-global-context (#12291)

**shader-slang/slang#12291** — on `-target metal`, a `uniform` fixed-size array of resource-containing structs (e.g. `uniform MyTensor tensors[4]`, `MyTensor{StructuredBuffer<float> buf;}`) emits a kernel arg `array<float device*, int(4)>` with **NO `[[buffer(N)]]`**. VK (SPIR-V descriptor array + Binding) and CUDA correct. Reproduced GPU-free @HEAD 7c58a326b via textual MSL emit (prebuilt Debug slangc).

## Root cause (source-verified; reporter's candidate pointer was WRONG)
The reporter (and an initial subagent hypothesis) pointed at `slang-ir-explicit-global-context.cpp` (`introduceExplicitGlobalContext`) as the flattening/drop site. **It is not.** Traced:
1. Layout is CORRECT and carries the binding. `createArrayLikeTypeLayout` (`slang-type-layout.cpp:5203-5230`) aggregates the element's resource usage onto the array layout. `_isDescriptorSlotLike` (`:5103`) returns true **only** for `DescriptorTableSlot` (or under HLSL→Vulkan opts) — NOT for Metal — so on Metal the array's offset-attr kind stays **`MetalBuffer`** (×count), not `DescriptorTableSlot`. A valid `MetalBuffer` offset reaches emit.
2. `introduceExplicitGlobalContext` (`:413/:460`) faithfully clones the param type + layout decoration into the KernelContext field — adds/drops nothing.
3. THE GAP is emit-only: `MetalSourceEmitter::emitFuncParamLayoutImpl` (`slang-emit-metal.cpp:166-170`) emits `[[buffer(N)]]` for `LayoutResourceKind::MetalBuffer` **only if** `paramType` ∈ {`IRPtrTypeBase`, `IRHLSLStructuredBufferTypeBase`, `IRByteAddressBufferTypeBase`, `IRUniformParameterGroupType`, `IRRaytracingAccelerationStructureType`}. The hoisted param is an `IRArrayType` → matches none → branch silently skipped. Same gap for `MetalTexture` (`:158-164`) and `SamplerState` (`:177-184`).
4. Why VK differs: `slang-emit-spirv.cpp:3597-3605` decorates `Binding` purely by resource-kind, **no type-shape guard** → array wrapper gets its Binding regardless.

## Empirical contrast matrix (the fast way to localize this)
- SINGLE `uniform MyTensor t` → `float device* ..._buf [[buffer(2)]]` ✅
- ARRAY `uniform MyTensor t[4]` → `array<float device*,4>` ❌ no binding
- BARE `uniform StructuredBuffer<float> bufs[4]` (no struct) → ❌ no binding
- `uniform Texture2D texs[4]` → `array<texture2d,4>` ❌ no `[[texture]]` (single sampler → `[[sampler(0)]]` ✅)
⇒ **Trigger is the ARRAY SHAPE for ANY resource kind; the struct wrapper is irrelevant.**

## LOAD-BEARING uncertainty (couldn't resolve in Linux sandbox — no metallib compile)
Metal natively supports `array<texture2d,N> [[texture(k)]]` / `array<sampler,N> [[sampler(k)]]` (consecutive slots), but **arrays of BUFFERS are NOT valid direct kernel args (≤ Metal 3.1)**. So the minimal emit-guard fix (admit `IRArrayType` in the guard) is clean+complete for texture/sampler arrays, but for the reported *buffer* case `array<device T*,N> [[buffer(k)]]` may be rejected by the Metal compiler — in which case buffers must route through Metal **argument-buffer** legalization (`ParameterBlock`/arg-buffer, as `tests/metal/sampler-array.slang` does; gate at `slang-ir-entry-point-uniforms.cpp:265` `needConstantBuffer`). This buffer-array-binding validity is the pivot of the fix and needs `-target metallib`/macOS-CI verification. Consistent with the shared #10842 note tagging plain arrays-of-resources on Metal as a genuine FEATURE GAP.

## Distinctions
- #10842 = bindless `DescriptorHandle<T>` on Metal → compiler emit DONE, gap is slang-rhi RUNTIME. This (#12291) is `slangc`'s own emit, upstream of runtime. Different layer.
- #7669 (fixed by #11607) = a DIFFERENT Metal binding-loss (wrapper-swap decoration re-point). Not this.

## Method takeaways
- Don't trust the reporter's "candidate fix layer" — trace it. Here it named the wrong pass; the real drop was 3 layers downstream at emit.
- The 4-way contrast matrix (single vs array, struct-wrapped vs bare, buffer vs texture) localized the trigger in minutes without a rebuild.
- A prebuilt Debug slangc (even a day old) is enough for textual-emit triage — check `build/Debug/bin/slangc` before assuming you must build.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785419415403-metal-drops-buffer-texture-n-for-uniform-array-of-.md`_
