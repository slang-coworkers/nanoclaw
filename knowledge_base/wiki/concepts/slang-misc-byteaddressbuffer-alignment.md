---
title: "Slang ByteAddressBuffer Alignment and Legalization"
type: concept
group: slang-grab-bag
tags: [ByteAddressBuffer, LoadAligned, StoreAligned, alignment, stride, float3, vec3, pow2, WGSL, SPIR-V, scalar-block-layout, codegen, IR]
source_count: 8
---

# Slang ByteAddressBuffer Alignment and Legalization

The `ByteAddressBuffer` family has subtle alignment semantics that differ by overload form, and the issue #11545 series of fixes spans four interdependent slices. This page consolidates the alignment invariants, the stride-vs-alignment distinction, and the codegen legalization pipeline.

## Alignment Semantics by Form

The single-arg `LoadAligned<T>(uint)` and `StoreAligned<T>` overloads compute alignment as `__naturalStrideOf<T>()` at compile time. The alignment parameter is informational-only on HLSL targets but carries meaning for SPIR-V/Metal/WGSL lowering. The unsuffixed `Store2/3/4(addr, valueN, alignment)` forms are aligned stores hiding under an unsuffixed name ([Slang ByteAddressBuffer single-arg *Aligned forms use natural stride (not ambiguous)](../learnings/1780768566167-slang-byteaddressbuffer-single-arg-aligned-forms-u.md)).

## The Stride-vs-Alignment Bug (float3 / vec3)

The single-arg `LoadAligned<T>(offset)` forms forward `__naturalStrideOf<T>()` — the **stride**, not the alignment — as the alignment operand. For 3-component vectors like `float3`, stride = 12 (non-power-of-two), which is the root of pow2-alignment errors on WGSL. This coupling drives the `#11505`/`#11545` series ([Slang ByteAddressBuffer implicit LoadAligned<T>(offset) passes STRIDE as alignment (non-pow2 for vec3)](../learnings/1781030980541-slang-byteaddressbuffer-implicit-loadaligned-t-off.md)).

A naive pow2 check on the alignment operand of `LoadAligned` would break every `float3` load because the implicit form passes stride (12) as alignment. The fix requires changing implicit forms to forward natural alignment, coupling #11545 point 4 with the #11505 API-surface cleanup ([Slang byte-address: a naive pow2-alignment check breaks single-arg LoadAligned<float3> (#11545 point 4 ↔ #11505)](../learnings/1781158312869-slang-byte-address-a-naive-pow2-alignment-check-br.md)).

## The Four-Slice Plan (Issue #11545)

The alignment work is split into four interdependent slices:

- **Slice 1**: Redefine implicit LoadAligned natural-alignment infrastructure (`getNaturalAlignment` in IR ops)  
- **Slice 2**: Add pow2-alignment validation error; diagnostic 41303 cannot live here because the single-arg forwarder still passes natural STRIDE, causing false-rejects of valid 3-component loads ([slang #11591/#11590 — prior 41303-to-Slice-3 ruling (1781318517600) re-verified VALID at HEAD a84f48e62 post-#11594; carrying 41303 in Slice 2 is a confirmed band-aid](../learnings/1781776078394-slang-11591-11590-prior-41303-to-slice-3-ruling-17.md))  
- **Slice 3 (#11592)**: Partially blocks on Slice 1 but has non-obvious partial dependency
- **Slice 4 (#11593)**: Chunked widest-power-of-two sub-vector load/store tier in ByteAddressBuffer legalization

Adding pow2-alignment validation must be coupled in the same PR with changing the implicit single-arg LoadAligned forms to pass natural alignment, because float3's stride (12) is non-power-of-two and would trigger the new error on every 3-component load ([slang #11545 — pow2-alignment validation must fix implicit LoadAligned forms in same PR (else float3 breaks)](../learnings/1781133163629-slang-11545-pow2-alignment-validation-must-fix-imp.md)).

Details on the four-slice decomposition and specific file locations for natural-alignment infrastructure ([slang #11545 alignment work split into 4 slices; Slice 3 (#11592) only partially blocks on Slice 1](../learnings/1781315409904-slang-11545-alignment-work-split-into-4-slices-sli.md)).

## Chunked Byte-Address Codegen (Slice 4 / #11593)

The chunked tier adds widest-power-of-two sub-vector load/store for values larger than the maximum atomic width. The correct insertion point is `slang-ir-byte-address-legalize.cpp`; chunking must be vector-specific; alignment must be recomputed per-chunk; dependencies on prior slices must be satisfied first ([slang #11593 chunked byte-address codegen — insertion point + vector-specific constraint](../learnings/1781315228593-slang-11593-chunked-byte-address-codegen-insertion.md)).

## Scalar Block Layout and ArrayStride

`VK_EXT_scalar_block_layout` is required by the declared SPIR-V `ArrayStride` decoration (validated at pipeline creation), **not** by how loads are emitted. Scalarizing loads while keeping a `float3[]@12` declaration still requires the device feature. For portability, declare a scalar `float[]` array instead ([Slang scalar-block-layout is forced by the ArrayStride decoration, not by load codegen](../learnings/1782722840826-slang-scalar-block-layout-is-forced-by-the-arrayst.md)).

---
**Source learnings (9):**
- [single-arg aligned forms use natural stride](../learnings/1780768566167-slang-byteaddressbuffer-single-arg-aligned-forms-u.md)
- [implicit LoadAligned passes STRIDE as alignment](../learnings/1781030980541-slang-byteaddressbuffer-implicit-loadaligned-t-off.md)
- [pow2 validation must fix implicit forms in same PR](../learnings/1781133163629-slang-11545-pow2-alignment-validation-must-fix-imp.md)
- [naive pow2 check breaks float3](../learnings/1781158312869-slang-byte-address-a-naive-pow2-alignment-check-br.md)
- [chunked byte-address codegen insertion point](../learnings/1781315228593-slang-11593-chunked-byte-address-codegen-insertion.md)
- [alignment work split into 4 slices](../learnings/1781315409904-slang-11545-alignment-work-split-into-4-slices-sli.md)
- [prior 41303-to-Slice-3 ruling re-verified](../learnings/1781776078394-slang-11591-11590-prior-41303-to-slice-3-ruling-17.md)
- [scalar block layout forced by ArrayStride](../learnings/1782722840826-slang-scalar-block-layout-is-forced-by-the-arrayst.md)
_Catalog: [[wiki/index.md]]_
