---
title: "Slang scalar-block-layout is forced by the ArrayStride decoration, not by load codegen"
type: learning
topic: slang-compiler
source: learnings/1782722840826-slang-scalar-block-layout-is-forced-by-the-arrayst.md
---

# Slang scalar-block-layout is forced by the ArrayStride decoration, not by load codegen

From triaging shader-slang/slang#11813 ("access memory traits orthogonal to DataLayout"). Augments learning 1780177237717 (per-target float3/ScalarDataLayout stride) with the design insight that matters when anyone proposes "just scalarize the loads to avoid scalarBlockLayout."

**The trap:** It's tempting to think `StructuredBuffer<float3, ScalarDataLayout>` could be made portable (no `VK_EXT_scalar_block_layout` device feature) just by emitting component-wise (scalarized) loads — 3× 32-bit loads instead of one `OpLoad` of a vec3. **This does not work.** The `scalarBlockLayout` requirement is triggered by the *declared* SPIR-V layout decoration `OpDecorate <arr> ArrayStride 12` on a `vec3` array, which the Vulkan driver validates at **pipeline creation** — entirely independent of how the shader instructions load the element. A `vec3` has base alignment 16 under standard/std430 buffer layout, so an ArrayStride of 12 is illegal there and only legal once `scalarBlockLayout` relaxes alignment to the 4-byte component alignment.

**Consequence for any "scalarized access" feature:** to be portable AND tight, the storage element that gets the `ArrayStride` decoration must itself be a *scalar* array (`float[]`, stride 4, alignment 4 — always legal under std430), with the typed `float3` synthesized from 3 component loads at byte offsets `12*i+{0,4,8}`. Merely scalarizing the loads while keeping the `float3[]`@12 declaration still emits ArrayStride 12 and still needs the device feature.

**Why `ByteAddressBuffer.Load<float3>(12*i)` already is portable+tight:** ByteAddressBuffer is declared as `uint[]` at stride 4 — there is no typed-array `ArrayStride` decoration to trip scalarBlockLayout — and Slang decomposes the templated load into 3 scalar `f32` loads (the byte-address `scalarizeVectorLoadStore` machinery in `slang-ir-byte-address-legalize.cpp`, set in `slang-emit.cpp`). That's the existing portable workaround; the only thing lost vs a `StructuredBuffer<float3>` is the typed reflected element / generics-over-element.

Verified at HEAD 51959e21f. Layout axis lives in `hlsl.meta.slang` (`IBufferDataLayout` :24, structs :31-71); rule selection `getTypeLayoutRuleNameForBuffer` in `slang-ir-lower-buffer-element-type.cpp`; SB load/store lowering `slang-ir-spirv-legalize.cpp` `processStructuredBufferLoad`/`processRWStructuredBufferStore`. Related active design: ByteAddressBuffer-alignment cluster #11545/#11591/#11592/#11593 (maintainer-driven wide-vs-scalarized codegen).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1782722840826-slang-scalar-block-layout-is-forced-by-the-arrayst.md`_
