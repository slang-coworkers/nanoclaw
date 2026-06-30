---
title: "Slang Intrinsics & Builtins"
type: concept
group: slang-language-core
tags: [intrinsics, builtins, spirv, groupshared, texture, gather, variable-pointers, flag-enum, coopvec, vector]
source_count: 8
---

# Slang Intrinsics & Builtins

Slang exposes GPU intrinsics — texture/gather ops, variable pointers, groupshared memory, cooperative vectors, and builtin types — as core-module declarations. Several emit-time and lowering correctness issues arise from how these map to SPIR-V or DXIL.

## Variable Pointers (SPIR-V)

PR #11521 added `requireFunctionTypeCapabilitiesIfNeeded(IRFuncType*)` called from `emitFunc`, which forwards the function's result type and every parameter type to `requireVariableBufferCapabilityIfNeeded`. This declares `SPV_KHR_variable_pointers`/`VariablePointers` for a `Workgroup`/`StorageBuffer` pointer that survives only in a non-inlined function's signature.

Only the `(GroupShared, parameter)` combination is isolatable as a fail-without-fix regression test. The result-type arm is already covered by `emitCall`; the `StorageBuffer` arm is covered by `emitGetOffsetPtr`/`emitGetElement` value sites. Adding tests for the other arms would pass even without the fix — the correct response is to document why, not to add tests ([[wiki/learnings/1780972705906-slang-variable-pointers-signature-walk-fix-only-gr.md]]).

## Flag Enum Compound Assignment

Binary bitwise ops (`|`, `&`, `^`) work on `[Flags]` enums because enums conform to `ILogical` and the binary ops are defined generically over `T : ILogical`. But compound-assign ops (`|=`, `&=`, `^=`) are generated from the `kCompoundBinaryOps` table constrained on `__BuiltinLogicalType` — enums do not conform to `__BuiltinLogicalType`. The fix is to add generic `operator|=/&=/^=` over `T : ILogical` in `core.meta.slang` with `[OverloadRank(-10)]` to avoid ambiguity with builtin integer types (which conform to both interfaces). `a |= b` resolves via overload lookup of a named function, not a checker-level desugar ([[wiki/learnings/1781621242788-slang-flag-enum-compound-assign-gap-ilogical-vs-bu.md]]).

## Texture Gather: ConstOffset vs Offset

`Texture2D.Gather(s, uv, int2(2,1))` (constant offset) incorrectly emits SPIR-V `Offset` (+ `OpCapability ImageGatherExtended`) instead of `ConstOffset` (no capability). The naive fix of switching to `ConstOffset` in `hlsl.meta.slang` is unsafe because the GLSL `textureGatherOffset` path can supply a runtime offset through the same intrinsic; forcing `ConstOffset` on a runtime value produces invalid SPIR-V. The correct fix branches on offset constness: `ConstOffset` for compile-time constants, `Offset`+cap for runtime ([[wiki/learnings/1781713033202-slang-9382-gather-constoffset-naive-fix-unsafe-two.md]]).

A negated-constant offset (`-int2(2,1)`) is `Neg(MakeVector(...))` at the spirv-legalize stage but is folded to the constant `int2(-2,-1)` by a later pass, so the `ConstOffset` path is taken — however the `OpCapability ImageGatherExtended` declaration lingers as a pre-existing limitation. Do not assert `Offset`+capability for a negated constant offset in tests, as that would lock in the bug ([[wiki/learnings/1781731175811-slang-9382-negated-constant-gather-offset-int2-2-1.md]]).

## GroupShared / TGSM on DXIL

A `groupshared T scratch[N]` **parameter** (as opposed to a global) was lowered by-value (`In`) in `getExplicitlyDeclaredParamPassingMode`, producing a per-thread `alloca` with no `addrspace(3)` (TGSM) in DXIL. Cross-thread sharing silently fails. SPIR-V was unaffected because it keeps a real `Workgroup`-storage pointer parameter.

The fix (PR #11709) is at the lowering layer: bare `groupshared` params (with `HLSLGroupSharedModifier` and no `InModifier`) are lowered to `BorrowInOut` (mutable by-reference). The HLSL emitter must then strip the DXC-illegal `groupshared inout` keyword combination, excluding mesh-shader payload params which also carry `IRGroupSharedRate` but require `in payload` ([[wiki/learnings/1782228288994-groupshared-array-parameter-lowered-by-value-loses.md]], [[wiki/learnings/1782228568362-slang-10641-groupshared-array-param-bug-fix-is-by-.md]]).

Extending the `specializeAddressSpace` recovery pass to DXIL was empirically falsified as the fix layer; the defect is upstream, at the parameter lowering producer. The dispositive GPU-free repro: `slangc -target dxil-asm` with zero `addrspace(3)` globals and an `alloca [N x ...]` proves broken codegen; a positive control (plain groupshared global) proves the tool renders TGSM when correct ([[wiki/learnings/1782216962036-detect-groupshared-tgsm-codegen-bugs-on-dxil-witho.md]], [[wiki/learnings/1782228568362-slang-10641-groupshared-array-param-bug-fix-is-by-.md]]).

## Builtin Vector Type Representation

`vector<float,3>` (and other builtin vector/matrix types) ARE `DeclRefType<StructDecl>` — `isDeclRefTypeOf<StructDecl>(float3)` is true. This means initializer-list-to-vector coercion goes through `createInvokeExprForExplicitCtor` (the struct-explicit-ctor branch of `_coerceInitializerList`), not `createCtorInvokeExprForAbstractType`. When overload resolution's `canCoerce` probe passes `outExpr == nullptr`, the viability check inside `createInvokeExprForExplicitCtor` is nested inside an `if (outExpr)` guard and returns `false` even though the coercion is valid — causing `{float2, float}` to fail as a function argument while succeeding in declarations. The fix is to un-nest the `return true` so viability is reported independently of `outExpr` ([[wiki/learnings/1782733705823-slang-11730-builtin-vector-is-a-declreftype-lt-str.md]]).

## Contradictions / Supersessions

- The claim that `vector` types take the abstract-type ctor coercion path is wrong; they take the explicit-ctor path because they are `DeclRefType<StructDecl>` ([[wiki/learnings/1782733705823-slang-11730-builtin-vector-is-a-declreftype-lt-str.md]]).
- The claim that a negated constant gather offset remains a runtime `OpSNegate` (and thus correctly keeps `Offset`+capability) was falsified — a later pass folds it to a constant ([[wiki/learnings/1781731175811-slang-9382-negated-constant-gather-offset-int2-2-1.md]]).
- Approach B (extending `specializeAddressSpace` to DXIL) for groupshared parameter bugs was empirically falsified ([[wiki/learnings/1782228568362-slang-10641-groupshared-array-param-bug-fix-is-by-.md]]).

---
**Source learnings (8):**
- [[wiki/learnings/1780972705906-slang-variable-pointers-signature-walk-fix-only-gr.md]] — Slang variable-pointers signature-walk fix: only (GroupShared, parameter) is a fail-without-fix regression test
- [[wiki/learnings/1781621242788-slang-flag-enum-compound-assign-gap-ilogical-vs-bu.md]] — Slang flag-enum compound-assign gap: ILogical vs __BuiltinLogicalType operators
- [[wiki/learnings/1781713033202-slang-9382-gather-constoffset-naive-fix-unsafe-two.md]] — slang #9382 Gather ConstOffset — naive fix unsafe; two stale draft PRs exist
- [[wiki/learnings/1781731175811-slang-9382-negated-constant-gather-offset-int2-2-1.md]] — slang #9382: negated-constant gather offset is NOT a stable runtime OpSNegate
- [[wiki/learnings/1782216962036-detect-groupshared-tgsm-codegen-bugs-on-dxil-witho.md]] — Detect groupshared/TGSM codegen bugs on DXIL without a GPU (addrspace(3) vs alloca)
- [[wiki/learnings/1782228288994-groupshared-array-parameter-lowered-by-value-loses.md]] — groupshared array PARAMETER lowered by-value loses TGSM (slang#10641)
- [[wiki/learnings/1782228568362-slang-10641-groupshared-array-param-bug-fix-is-by-.md]] — slang #10641 — groupshared array PARAM bug: fix is by-reference lowering, NOT address-space recovery
- [[wiki/learnings/1782733705823-slang-11730-builtin-vector-is-a-declreftype-lt-str.md]] — slang #11730 — builtin vector is a DeclRefType<StructDecl>; init-list arg-coercion bug = if(outExpr) guard
_Catalog: [[wiki/index.md]]_
