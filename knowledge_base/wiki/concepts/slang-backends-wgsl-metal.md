---
title: "Slang WGSL and Metal Backends: Textual Constructor-Syntax Targets"
type: concept
group: slang-backends
tags: [wgsl, metal, webgpu, combined-sampler, static-const, buffer-layout, wave-intrinsics]
source_count: 6
---

# Slang WGSL and Metal Backends: Textual Constructor-Syntax Targets

The WGSL (`slang-emit-wgsl.cpp`) and Metal (`slang-emit-metal.cpp`) backends are textual targets that, unlike HLSL, require constructor-syntax aggregate initializers and lack native combined samplers. Several codegen bugs span the WGSL/Metal/CUDA target family because they share the same `$N` positional intrinsic-string and value-indexability constraints. This page covers WGSL/Metal-specific emission issues.

## Static-Const Arrays Must Be var<private> for Runtime Indexing

In WGSL, a `const` is a compile-time value (≈C++ constexpr); the spec only lets a *value* of array type be indexed by a const-expression. A `static const` array indexed by a runtime value (e.g. `positions[SV_VertexID]`) emitted as WGSL `const` is rejected by naga/tint. The fix in `emitVarKeywordImpl` flips the keyword `const`→`var<private>` for module-scope array/matrix constants — yielding a runtime-indexable private var with a const-expression initializer ([[wiki/learnings/1781624737396-wgsl-emit-static-const-arrays-must-be-var-private-.md]]).

The conversion is safe as a type-based transform (no use-analysis needed) because `replaceGlobalConstants` inlines GlobalConstant values into uses before `simplifyIR`, and peephole folds constant-index reads away — so no `const` is left reading the now-`var<private>` array. A residual edge case (CSE-shared inner array both nested and independently runtime-indexed) is a documented known limitation, not a regression ([[wiki/learnings/1781639050403-wgsl-static-const-array-review-replaceglobalconsta.md]]). The WGSL value-indexability rule: array values need const indexing, but vector/matrix values ARE runtime-indexable — so only `kIROp_ArrayType` globals need conversion.

When reviewing such PRs, the recurring false-positive "the converted `var<private>` is initialized from another `var<private>` → invalid WGSL" must be verified against the actual post-link IR — `replaceGlobalConstants` removes the `IRGlobalConstant`, so no GlobalConstant survives to emit ([[wiki/learnings/1781639050403-wgsl-static-const-array-review-replaceglobalconsta.md]]).

## WGSL @location Return-0 Fallback Branch

On WGSL PRs adding a `resolveWGSLLocation`-style helper with an index-less `return 0` fallback, reviewers reliably suggest covering the fallback by adding a no-digit field (e.g. `: SV_TARGET`) alongside an indexed sibling (`: SV_TARGET2`). This is infeasible in one struct: a bare `SV_TARGET` and `SV_TARGET0` both resolve to `@location(0)`, an invalid WGSL collision. Covering the branch needs a separate struct, and declining the in-struct test is reasonable when the fallback is pre-existing behavior unchanged by the PR ([[wiki/learnings/1781663682498-wgsl-location-return-0-fallback-branch-can-t-be-un.md]]).

## Combined-Sampler GetDimensions Off-By-One (WGSL/Metal/CUDA)

`Sampler2D<T>.GetDimensions(out0, out1)` miscompiles on WGSL (#11669), Metal, and likely CUDA: width is written to the sampler var, height to the first output, second output never written. SPIR-V and GLSL escape (SPIR-V has a dedicated combined variant; GLSL keeps native `sampler2D`).

Root cause: for targets without native combined samplers, `lowerCombinedTextureSamplers` splits `Sampler2D` into `struct{texture,sampler}`, so call operands become `[texture, sampler, out0, out1]`. The WGSL/Metal/CUDA `GetDimensions` intrinsic strings are C++-generated in `TextureTypeInfo::writeGetDimensionFunctions()` and reference operands positionally (`$0`=receiver, `$1`/`$2`=outputs), assuming the receiver is ONE operand. The combined-sampler compensation `m_argIndexOffset -= 1` fires only under the `$p` marker, which these strings never emit. This shares a root cause with HLSL #10522; the endorsed fix is a source/early-IR rewrite `combinedSampler.GetDimensions(...)` → `combinedSampler.__getTexture().GetDimensions(...)` that fixes all four targets at once. Triage tip: when a combined-sampler intrinsic miscompiles on one target, check the other `$N`-string targets ([[wiki/learnings/1781992589265-combined-sampler-getdimensions-off-by-one-wgsl-met.md]]).

## Per-Target Buffer Stride (WGSL Outlier)

For `StructuredBuffer<float3, ScalarDataLayout>`, the stride is 12 bytes on D3D/HLSL, Vulkan/SPIR-V (requires the layout arg), CUDA, and Metal — but **WGSL hard-codes 16** in `slang-ir-lower-buffer-element-type.cpp` (an array of scalar/vector always converts to 16-byte-aligned vector). So `<float3, ScalarDataLayout>` cannot give tight 12-byte stride on WGSL. The workaround is `RWByteAddressBuffer.Load<float3>`/`.Store<float3>` with explicit 12-byte stride — decomposed into three scalar `f32` loads. The `scalarizeVectorLoadStore` flag is set for WGSL, Metal, and CPU-via-LLVM targets in `slang-emit.cpp` ([[wiki/learnings/1780177237717-slang-per-target-stride-for-structuredbuffer-float.md]]).

## Wave Aggregate Intrinsics (CUDA/Metal FileCheck Trap)

When reviewing coverage/wave-aggregation PRs, a FileCheck `//CHECK-DAG: WaveActiveCountBits` on CUDA or Metal output is false confidence. Only `case hlsl:` emits the literal `WaveActiveCountBits`; CUDA lowers to `__popc(__ballot_sync(...))` and Metal to `_WaveCountBits(WaveActiveBallot(value))`. The literal token can appear in CUDA/Metal output only as the name of the force-kept `[KnownBuiltin]` definition, not as the per-marker increment. Correct checks: CUDA → `__ballot_sync`/`__popc`; Metal → `simd_ballot`/`popcount` (and `simd_is_first` for `WaveIsFirstLane`) ([[wiki/learnings/1780935575501-coverage-wave-aggregate-tests-cuda-metal-filecheck.md]]).

## General Cross-Target Lesson

WGSL is the "other constructor-syntax, no brace-init" textual target alongside GLSL. When a `-target glsl` text-output codegen bug appears (e.g. array brace init), check whether the WGSL emitter already solved the same shape — the override often exists in `slang-emit-wgsl.cpp` and just needs porting ([[wiki/learnings/1780177237717-slang-per-target-stride-for-structuredbuffer-float.md]]).

## FP literal type suffixes (Metal outlier) + WGSL f16 already works

The Metal source emitter is the **lone** C-like backend that prints floating-point literals with **no** type suffix. `MetalSourceEmitter::emitSimpleValueImpl` (`slang-emit-metal.cpp:1128-1164`) omits the MSL `h`/`f` suffix, so a `half` literal like `61440.hf` degrades to a bare double — the fix mirrors the WGSL/HLSL path by appending the suffix ([[wiki/learnings/1782814984950-slang-metal-backend-emits-fp-literals-with-no-type.md]], [[wiki/learnings/1782832643994-metal-emitter-is-the-lone-backend-that-omits-fp-li.md]]). Separately, do **not** treat WGSL as missing 16-bit float support: verified at HEAD, the WGSL/WebGPU backend already fully supports `half`/`f16`; a "WGSL missing f16" report is almost always the 16-bit **integer** (`bit_cast<uint16_t>`) path surfacing E56103, a different gap ([[wiki/learnings/1782813507927-wgsl-f16-floats-already-work-e56103-is-the-16-bit-.md]]).

---
**Source learnings (9):**
- [[wiki/learnings/1780177237717-slang-per-target-stride-for-structuredbuffer-float.md]] — Slang per-target stride for `StructuredBuffer<float3, ScalarDataLayout>` — WGSL is the outlier
- [[wiki/learnings/1780935575501-coverage-wave-aggregate-tests-cuda-metal-filecheck.md]] — Coverage wave-aggregate tests — CUDA/Metal FileCheck asserting `WaveActiveCountBits` passes for the wrong reason
- [[wiki/learnings/1781624737396-wgsl-emit-static-const-arrays-must-be-var-private-.md]] — WGSL emit: static-const arrays must be var<private> (not const) for runtime indexing
- [[wiki/learnings/1781639050403-wgsl-static-const-array-review-replaceglobalconsta.md]] — WGSL static-const-array review: replaceGlobalConstants false-positive + value-indexability rule
- [[wiki/learnings/1781663682498-wgsl-location-return-0-fallback-branch-can-t-be-un.md]] — WGSL @location return-0 fallback branch can't be unit-tested in one struct
- [[wiki/learnings/1781992589265-combined-sampler-getdimensions-off-by-one-wgsl-met.md]] — Combined-sampler GetDimensions off-by-one (WGSL/Metal/CUDA) — shared root with HLSL #10522
- [[wiki/learnings/1782814984950-slang-metal-backend-emits-fp-literals-with-no-type.md]] — Slang Metal backend emits FP literals with NO type suffix (#11837)
- [[wiki/learnings/1782832643994-metal-emitter-is-the-lone-backend-that-omits-fp-li.md]] — Metal emitter is the lone backend that omits FP literal type suffixes
- [[wiki/learnings/1782813507927-wgsl-f16-floats-already-work-e56103-is-the-16-bit-.md]] — WGSL f16 floats already work; E56103 is the 16-bit-INTEGER path (#11835)
_Catalog: [[wiki/index.md]]_
