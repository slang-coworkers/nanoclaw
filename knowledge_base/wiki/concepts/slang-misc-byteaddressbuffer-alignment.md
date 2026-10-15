---
title: "Slang ByteAddressBuffer Alignment and Legalization"
type: concept
group: slang-grab-bag
tags: [ByteAddressBuffer, LoadAligned, StoreAligned, alignment, stride, float3, vec3, pow2, WGSL, SPIR-V, scalar-block-layout, codegen, IR]
source_count: 14
---

# Slang ByteAddressBuffer Alignment and Legalization

The `ByteAddressBuffer` family has subtle alignment semantics that differ by overload form, and the issue #11545 series of fixes spans four interdependent slices. This page consolidates the alignment invariants, the stride-vs-alignment distinction, and the codegen legalization pipeline.

## TL;DR
- Alignment and stride are different properties: a `float3`/`vec3` element has a 12-byte size but a 16-byte stride in most layouts, and conflating them is the recurring bug in this area.
- **On SPIR-V/GLSL, a plain `Load<float3>(addr)`/`Store<float3>` at a nonzero multiple of 12 touches the wrong bytes** (#13603): the structured-buffer translation divides the byte offset by the natural stride (12), but the aliased vec3 array has `ArrayStride` 16. Use address 0 in float3 byte-address docs and tests, or pin HLSL only.
- `ByteAddressBuffer` alignment semantics differ per access form (scalar vs vector vs struct) — check the form, not just the element type.
- Scalar block layout changes `ArrayStride`; a fix validated only under the default layout can regress under it.
- Verify byte-address / HLSL-profile changes at an explicit `-profile cs_5_0`, not just `-target hlsl` — the profile, not the target, selects the code path.
- The #11545 work was staged in four slices; a change touching one slice needs the others re-checked before it is called complete.
- **Never group `bool` when splitting byte-address vectors** (#11803): `vector<bool,N>` sub-access is invalid SPIR-V (`OpTypeBool` in StorageBuffer, E99999) and silently wrong on CPU/CUDA (2-byte `sizeof` vs 4-byte BAB stride). Return width 1 for `IRBoolType` in the group-width chooser, and probe new splits per element type with a `-cpu` readback.
- **Templated `ByteAddressBuffer.Load<T>` works at SM 6.0 with `-HV 2018`** (DXC's own `raw_buf3.hlsl` RUN line). SM 6.2 is the 16-bit-types boundary, which search summaries conflate with it. Take capability boundaries from a primary source.

## Alignment Semantics by Form

The single-arg `LoadAligned<T>(uint)` and `StoreAligned<T>` overloads compute alignment as `__naturalStrideOf<T>()` at compile time. The alignment parameter is informational-only on HLSL targets but carries meaning for SPIR-V/Metal/WGSL lowering. The unsuffixed `Store2/3/4(addr, valueN, alignment)` forms are aligned stores hiding under an unsuffixed name ([Slang ByteAddressBuffer single-arg *Aligned forms use natural stride (not ambiguous)](../learnings/1780768566167-slang-byteaddressbuffer-single-arg-aligned-forms-u.md)).

## The Stride-vs-Alignment Bug (float3 / vec3)

The single-arg `LoadAligned<T>(offset)` forms forward `__naturalStrideOf<T>()` — the **stride**, not the alignment — as the alignment operand. For 3-component vectors like `float3`, stride = 12 (non-power-of-two), which is the root of pow2-alignment errors on WGSL. This coupling drives the `#11505`/`#11545` series ([Slang ByteAddressBuffer implicit LoadAligned<T>(offset) passes STRIDE as alignment (non-pow2 for vec3)](../learnings/1781030980541-slang-byteaddressbuffer-implicit-loadaligned-t-off.md)).

A naive pow2 check on the alignment operand of `LoadAligned` would break every `float3` load because the implicit form passes stride (12) as alignment. The fix requires changing implicit forms to forward natural alignment, coupling #11545 point 4 with the #11505 API-surface cleanup ([Slang byte-address: a naive pow2-alignment check breaks single-arg LoadAligned<float3> (#11545 point 4 ↔ #11505)](../learnings/1781158312869-slang-byte-address-a-naive-pow2-alignment-check-br.md)).

The same 12-vs-16 mismatch also corrupts plain, no-promise loads on SPIR-V and GLSL, and it is reachable on master (#13603, related to the closed #9931). With `translateToStructuredBufferOps`, `emitSimpleLoad`/`emitSimpleStore` in `slang-ir-byte-address-legalize.cpp` turn the byte offset into an element index by dividing by the natural stride, which is 12 for `float3`. The aliased vec3 runtime array they index is declared with `ArrayStride` 16, so `Load<float3>(12)` reads bytes 16–27 instead of 12–23. Plain `Load` accepts a whole `float3` whenever the literal address is a multiple of 12, so no diagnostic stops it. Until this is fixed, write float3 byte-address examples and tests at address 0, or pin them to HLSL, so they do not enshrine the wrong bytes [plain ByteAddressBuffer Load<float3> at a nonzero multiple of 12 reads the wrong bytes](../learnings/1791904799552-slang-spir-v-glsl-plain-byteaddressbuffer-load-flo.md).

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
## Byte-Address / HLSL-Profile Changes: Verify at `-profile cs_5_0`, Not Just `-target hlsl` (2026-07-20 fold)

A byte-address (or any HLSL-profile-sensitive) codegen change can pass all `-target hlsl`/`-target spirv` checks yet break the **fxc / DX ≤ 5.0** path, which sets `byteAddressBufferOptions.useBitCastFromUInt = true` (gated on `profile.getFamily()==DX && version <= DX_5_0`). fxc-era HLSL has NO templated `.Load<T>`/`.Store<T>` — such accesses must lower to untemplated `uint` `Load()`/`Store()` + `asfloat`/`asuint`. On slang#11803 the #11545 chunker split a partial-aligned `float4`@8 into typed `float2` sub-chunks — fine on modern HLSL, fxc-uncompilable on cs_5_0 — and it was CI-invisible because feature tests used `-target hlsl`/`spirv` (no profile). Rules: compile a repro at `-target hlsl -profile cs_5_0` and check for NO templated `Load<`/`Store<` and NO typed vectors, add a `-profile cs_5_0` regression test, and note the vector `useBitCastFromUInt` branch is DEAD for concrete-element-count vectors — fxc-compat relies on the scalarize path, so fall back to `emitLegalSequenceLoad/Store` when the flag is set rather than chunking ([byte-address / HLSL-profile changes: verify at -profile cs_5_0](../learnings/1784438217128-byte-address-hlsl-profile-changes-verify-at-profil.md)).

A distinct byte-address legalization bug (#12265): `InterlockedAdd` on a `RWByteAddressBuffer` passed into a helper silently corrupts `Load`/`Store` indexing on CPU/C++. `getEquivalentStructuredBuffer`'s IRParam branch does `babType->replaceUsesWith(structuredBufferType)` — but Slang IR types are **deduplicated**, so that one shared `RWByteAddressBuffer` type inst is flipped to `RWStructuredBuffer<uint32_t>` **module-wide**, leaving byte-address `Load`/`Store` with offsets never divided by the element stride. C++/CPU-only because the byte-offset→element-index `÷ stride` rewrite is gated off for that target (GLSL/SPIRV/Metal rewrite correctly); the global-param branch, which creates a *separate* structured-buffer global instead of mutating in place, is the contrast that pins it. General rule: never `replaceUsesWith` on a shared *type* inst to convert one value's type — build a per-use cast/view at the use site ([RWByteAddressBuffer atomic-via-helper flips whole-module buffer type via shared dedup type-inst mutation](../learnings/1785339952123-rwbyteaddressbuffer-atomic-via-helper-flips-whole-.md)).

## Splitting byte-address vectors: never group `bool` (#11803)

PR #11803 groups partially aligned ByteAddressBuffer accesses into typed sub-vectors (for example `float4`@8 → 2×`float2`, via `emitLegalGroupedVectorLoad/Store` and `chooseGroupWidth`). `bool` must stay per-component, because it is a logical type with a 4-byte BAB stride. All three automated reviewers missed this; it was found only by probing `bool` element types and running a CPU runtime test.

- **SPIR-V:** `vector<bool,2>` becomes a `StructuredBuffer<bool2>` that `KhronosTargetBufferElementTypeLoweringPolicy::needsElementLowering` (`slang-ir-lower-buffer-element-type.cpp`) never lowers, since it matches only *scalar* `IRBoolType`. The result is `OpTypeBool` in `StorageBuffer`: E99999 under `SLANG_RUN_SPIRV_VALIDATION=1`, and rc 0 with invalid output without it.
- **CPU:** `Load<Vector<bool,2>>` reads `sizeof` = 2 bytes, so the buffer `[1 0 1 1 | 0 1 0 1]` read back as `1 0 1 0 0 0 0 0`. **CUDA:** `Load<bool2>` does `memcpy(2)`, the same mismatch.

The fix is at the producer: return width 1 for `IRBoolType` in the group-width chooser. Fully wide `LoadAligned<bool4>(loc, 16)` and `RWStructuredBuffer<bool2>` are already invalid SPIR-V on master; unwrapping vectors in `needsElementLowering` fixes SPIR-V but not CPU or CUDA. For any BAB width or vectorization change, probe `bool4` at a partial alignment (8), plain `Load<bool4>(8)`, `bool2x4`, `bool4[2]` and bool struct fields with SPIR-V validation, plus half and 64-bit types, and add a `COMPARE_COMPUTE -cpu` test with asymmetric per-component data. FileCheck tests that count `Load<float2>` cannot catch wrong offsets or order [BAB vector grouping must exclude bool](../learnings/1791865205035-bab-vector-grouping-must-exclude-bool-vector-bool-.md) [splitting byte-address vectors: never group bool](../learnings/1791869567632-splitting-byte-address-vectors-into-sub-vectors-ne.md).

## Templated `Load<T>` is SM 6.0, not SM 6.2

A web-search summary claimed templated `ByteAddressBuffer.Load<T>()` needs Shader Model 6.2, and it nearly went to a maintainer as a gap in Slang's fxc gate. It is false: DXC's own test `tools/clang/test/HLSLFileCheck/hlsl/objects/ByteAddressBuffer/raw_buf3.hlsl` runs `%dxc -E main -T ps_6_0 -HV 2018` with `.Load<float>`, `.Load<float2>`, `.Load<float4>` and `.Load<double2>`. SM 6.2 is the boundary for 16-bit scalar types (`-enable-16bit-types`), which the snippet conflated with templated loads. So the `useBitCastFromUInt` path described above (DX ≤ 5.0) is the right split for SM 6.x; whether SM 5.1 is right is a separate, unverified fxc question. Take a capability boundary ("needs SM X") from a primary source, such as the compiler's own test RUN line or its release notes. When a critique cites a counterexample test, fetch it, and when a premise collapses, re-audit what you already changed because of it [DXC templated Load<T> works at SM 6.0](../learnings/1791856275861-dxc-templated-byteaddressbuffer-load-t-works-at-sm.md).

**Source learnings (14):**
- [verify byte-address/HLSL-profile codegen at `-profile cs_5_0` (fxc has no templated `.Load<T>`); scalarize (not chunk) when `useBitCastFromUInt` is set; add a cs_5_0 regression test](../learnings/1784438217128-byte-address-hlsl-profile-changes-verify-at-profil.md)
- [single-arg aligned forms use natural stride](../learnings/1780768566167-slang-byteaddressbuffer-single-arg-aligned-forms-u.md)
- [implicit LoadAligned passes STRIDE as alignment](../learnings/1781030980541-slang-byteaddressbuffer-implicit-loadaligned-t-off.md)
- [pow2 validation must fix implicit forms in same PR](../learnings/1781133163629-slang-11545-pow2-alignment-validation-must-fix-imp.md)
- [naive pow2 check breaks float3](../learnings/1781158312869-slang-byte-address-a-naive-pow2-alignment-check-br.md)
- [chunked byte-address codegen insertion point](../learnings/1781315228593-slang-11593-chunked-byte-address-codegen-insertion.md)
- [alignment work split into 4 slices](../learnings/1781315409904-slang-11545-alignment-work-split-into-4-slices-sli.md)
- [prior 41303-to-Slice-3 ruling re-verified](../learnings/1781776078394-slang-11591-11590-prior-41303-to-slice-3-ruling-17.md)
- [scalar block layout forced by ArrayStride](../learnings/1782722840826-slang-scalar-block-layout-is-forced-by-the-arrayst.md)
- [#12265 `RWByteAddressBuffer` atomic-via-helper: `replaceUsesWith` on the shared deduplicated *type* inst flips every such buffer module-wide → CPU/C++ Load/Store lose the `÷stride`; build a per-use view, never mutate a shared type](../learnings/1785339952123-rwbyteaddressbuffer-atomic-via-helper-flips-whole-.md)
- [BAB vector grouping must exclude bool: vector<bool,N> sub-access breaks SPIR-V and silently corrupts CPU values](../learnings/1791865205035-bab-vector-grouping-must-exclude-bool-vector-bool-.md) — #11803; `needsElementLowering` matches scalar bool only; CPU/CUDA 2-byte reads; width 1 for IRBoolType; probe list
- [Splitting byte-address vectors into sub-vectors: never group bool](../learnings/1791869567632-splitting-byte-address-vectors-into-sub-vectors-ne.md) — same #11803 finding; probe per element type; asymmetric `-cpu` COMPARE_COMPUTE test
- [DXC templated ByteAddressBuffer Load<T> works at SM 6.0 (with -HV 2018) — not SM 6.2+](../learnings/1791856275861-dxc-templated-byteaddressbuffer-load-t-works-at-sm.md) — `raw_buf3.hlsl` RUN line; SM 6.2 is 16-bit types; capability boundaries need a primary source
- [Slang SPIR-V/GLSL: plain ByteAddressBuffer Load<float3> at a nonzero multiple of 12 reads the wrong bytes (#13603)](../learnings/1791904799552-slang-spir-v-glsl-plain-byteaddressbuffer-load-flo.md) — `emitSimpleLoad` divides by natural stride 12 while the aliased vec3 array has ArrayStride 16; use address 0 or pin HLSL

_Catalog: [[wiki/index.md]]_
