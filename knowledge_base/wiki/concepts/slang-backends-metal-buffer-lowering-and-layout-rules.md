---
title: "Metal buffer element lowering: packed vectors, layout-rule names, ignored CB data layouts, and ParameterBlock matrices"
type: concept
group: slang-backends
tags: [metal, msl, buffer-layout, packed-vector, makeVector, layout-rule, scalar-layout, parameterblock, matrix-layout, column-major, slang-ir-lower-buffer-element-type]
source_count: 7
---

# Metal buffer element lowering: packed vectors, layout-rule names, ignored CB data layouts, and ParameterBlock matrices

## TL;DR

- **A one-operand `makeVector(float4, packed_float4)` is Metal's packed→logical conversion, not a lane list.** `IRMetalPackedVectorType` is not an `IRVectorType`, so a peephole that treats a non-vector operand as one scalar lane stores a whole `packed_float4` into a float.
- **Count a lane only for an `IRBasicType` operand matching the result's element type, compared via `unwrapAttributedType`.** `unorm`/`snorm`/`no_diff` operands are `IRAttributedType`, and raw pointer equality silently loses folds; only a differential corpus compile caught it.
- **On Metal, CB `ScalarDataLayout` and `-fvk-use-scalar-layout` are silently ignored** in IR and reflection alike, so nothing miscompiles but the request is dropped. A fix must change both in lock step.
- **The buffer layout rule NAME is a lowering selector** (packing, struct clone, matrix lowering) and becomes the `_natural`/`_default` type-name suffix. A new rule changes MSL identifiers and needs a layout IR op; diff whole files.
- **`ParameterBlock` matrices ignore the matrix layout on Metal from v2025.18.2** (v2025.18.1 is good; still bad at v2026.20). They read back transposed against SPIR-V and against the cbuffer path: a real Metal-only transpose cause.
- **Workarounds:** `ConstantBuffer<S>` instead of `ParameterBlock<S>`, or `-matrix-layout-row-major`. Check the MSL for a native `matrix<float,4,4>` vs `_MatrixStorage`.

`slang-ir-lower-buffer-element-type.cpp` rewrites every buffer element type for Metal: it packs vectors, clones structs, lowers matrices to `_MatrixStorage` wrappers, and names the lowered types after the layout rule. This page covers the shapes that pass produces and the bugs that come from them. It was split out of [Metal backend](slang-backends-f0909b0-metal.md), which keeps the emitter-side Metal bugs; the by-design `mul(M,v)` operand swap is on [[wiki/concepts/slang-backends-metal.md]].

## Packed buffer vectors: a one-operand `makeVector` is a conversion, not a lane list

Metal buffer lowering converts between `vector<T,N>` and `IRMetalPackedVectorType` with a
one-operand `makeVector`. `__unpackVector` in `slang-ir-lower-buffer-element-type.cpp` (~:3041,
plus :2312 and :3069) emits `makeVector(float4, packed_float4Load)` and
`makeVector(packed_float4, v)`, and `slang-emit-metal.cpp:764` prints the first as `float4(p)`.
`IRMetalPackedVectorType` is a sibling of `IRVectorType`, not a subtype, so `as<IRVectorType>`
returns null for it. Any peephole that maps `makeVector` lanes to operands and assumes "not a
vector ⇒ one scalar lane" therefore mis-folds this shape: `swizzle`/`GetElement` lane 0 becomes
the whole `packed_float4`, and `StructuredBuffer<float4> c; out[i] = c[i].x;` on `-target metal`
emits `*(out+i) = *(c+i)`, storing a packed vector into a float. Master (checked 2026-09-30 at
16c3d3f686) already miscompiles `c[i][0]` this way through its `GetElement(makeVector)` fold, and
the swizzle fold on branch fix/issue-13263 extended the bug to `.x` and `.xx`. The fix counts an
operand as one lane only if it is an `IRBasicType` whose type equals the result's element type,
reads that element type from either `IRVectorType` or `IRMetalPackedVectorType` instead of
assuming the result is an `IRVectorType`, and otherwise gives up
[one-operand makeVector(float4, packed_float4) is a conversion](../learnings/1790765098240-metal-lowering-uses-a-one-operand-makevector-float.md),
[one-operand makeVector can be a Metal packed-vector conversion](../learnings/1790766506870-slang-ir-a-one-operand-makevector-can-be-a-metal-p.md).
That element-type equality must compare `unwrapAttributedType(...)` (`slang-ir-util.h:364`) on both
sides, not raw type pointers: `IRInst::getDataType()` strips only `IRRateQualifiedType`
(`slang-ir.cpp:8975`), so a `unorm float` operand is `IRAttributedType(float, UNorm)` and never
pointer-equals `float`. The front end lets such modifiers drop during coercion, so these values do
reach `makeVector` operands (`float2(RWTexture2D<unorm float>[id], 0.0)`). On fix/issue-13263 R2
(8a76ecc5f1) the raw check in `findMakeVectorLane` silently lost master's fold of
`float2(tex[id], 0.0).y` → `0.0f` — output stayed correct, so only a differential compile caught it:
build a base-reverted and a head binary, compile the ~1331-test corpus × spirv/hlsl/metal with
`xargs -P 48` and diff the stripped outputs (about 3 minutes). `__vectorReshape<1>(uint3(...))` is
callable from user code and is a handy trigger for `vector<T,1>`-typed swizzles in tests
[IR type-pointer equality misses IRAttributedType](../learnings/1790769162592-ir-type-pointer-equality-misses-irattributedtype-u.md).
The full slang-test suite did not catch it, because `tests/metal` is text-only FileCheck with no
case for this shape; a peer reviewer found it by probing `-target metal`. The regression test is
`tests/metal/swizzle-of-packed-vector-load.slang`, which checks that the output still goes
through `float4(`.

## Buffer layout rules on Metal: CB data-layout parameter ignored, and the rule NAME is a lowering selector (#13423)

On Metal (master 6ba151dcf), `ConstantBuffer<T, ScalarDataLayout>` and `-fvk-use-scalar-layout` are
silently ignored for constant buffers. The CB keeps native MSL `float3` (16 bytes), while
`StructuredBuffer<T>` is packed (`packed_float3`, 12 bytes, since #11578, between v2026.2 and
v2026.12). `getTypeLayoutRuleNameForBuffer` (slang-ir-lower-buffer-element-type.cpp:2416-2417)
returns Natural for every non-Khronos, non-LLVM target before it reads the buffer's explicit data
layout. `MetalBufferElementTypeLoweringPolicy::usesPackedVectorStorage` (:2991-3003) packs only the
StorageBuffer/UserPointer address spaces, and CBs are Uniform. Reflection's
`MetalLayoutRulesFamilyImpl::getConstantBufferRules` (slang-type-layout.cpp:2799) ignores both the
options and the container type. Emitted MSL and reflection agree (B@16), so nothing miscompiles;
the request is dropped with no diagnostic. Across targets, SPIR-V honors CB ScalarDataLayout,
HLSL/WGSL ignore it, CUDA/CPP are natural anyway, and `Std140DataLayout`/`Std430DataLayout` on Metal
give E36107. A fix must change IR and reflection in lock step, including the Tier-2 family at
type-layout.cpp:2869. Avoiding `float3` alone does not make native and scalar layouts coincide
(`float x; float4 y;` puts y at 16 native vs 4 scalar), so verify offsets per target with
`-reflection-json`
[Metal ConstantBuffer ignores the L data-layout parameter](../learnings/1791056669263-metal-constantbuffer-ignores-the-l-data-layout-par.md).

The `IRTypeLayoutRuleName` does more than pick layout numbers on Metal. The emitter never prints
strides or offsets (`array<T,N>` uses only operands 0 and 1, emit-metal.cpp:1472), but three
lowering gates read the rule name: `usesPackedVectorStorage` packs only for Natural, the struct
`isTrivial` check clones a struct when the rule is not Natural, and `shouldLowerMatrixType` leaves a
default-major matrix alone only for Natural. The name also becomes the `_natural`/`_default` suffix
of lowered type names through `getLayoutName`. Adding a rule name to a buffer class therefore changes
emitted MSL identifiers (`Args_natural_0` becomes `Args_default_0`) even when the layout is
unchanged. A "byte-identical" prototype claim on #13423 (a ~25-line change honoring only explicit
annotations) was false for exactly this reason, so diff whole files, identifiers included. A new rule
also needs a layout IR op: `fixBufferAccessPointerTypes` stamps `getOpFromTypeLayoutRuleName(rule)`
on derived pointers, and with no case for the new rule it falls back to `DefaultBufferLayoutType`,
which pointer queries map to Natural, leaving the buffer with two contradicting layouts
(`MetalParameterBlockLayout` is the precedent). `extras/check-ir-stable-names.lua update` re-sorts
and drops unrelated entries, so add the stable-name line by hand and then run `check`
[IR layout rule NAME is a lowering selector and leaks into MSL type names](../learnings/1791092001213-slang-ir-layout-rule-name-is-a-lowering-selector-a.md).

`getTypeLayoutRuleNameForBuffer`'s exact-target checks are also what break the WGSL-via-Tint path; see
[GLSL/WGSL emit and buffer layout](../concepts/slang-backends-f0909b0-glsl-wgsl-bindless.md).

## `ParameterBlock` matrices ignore the matrix layout on Metal (v2025.18.2 onward, #13141)

Consider `struct C { float4x4 m; }; ParameterBlock<C> c;` compiled with `slangc -target metal`. The matrix is emitted as a native `matrix<float,4,4>` inside an `S_default` struct, whatever the layout: the slangc default column-major and an explicit `column_major` qualifier are both ignored. The same `C` through `ConstantBuffer<C>`, a `cbuffer` or an entry-point `uniform` still emits `_MatrixStorage_..._ColMajor` plus an unpack, and SPIR-V marks the same member `RowMajor` (Slang column-major) at identical reflection offsets, so one host upload reads back transposed on Metal only. The cause is that `MetalParameterBlockElementTypeLoweringPolicy::shouldLowerMatrixType` returns false (slang-ir-lower-buffer-element-type.cpp ~3241). That early pass still stamps `[PhysicalType]`, and the later Metal pass skips `[PhysicalType]` types (~1825), so the matrix is never lowered (suspect PR #8591, 6a2cf239a8) [Metal ParameterBlock matrices ignore column_major since v2025.18.2](../learnings/1792157770273-metal-parameterblock-matrices-ignore-column-major-.md).

The exact boundary is v2025.18.1 good, v2025.18.2 bad; a 2026-10-19 re-check with release v2026.13.1 and v2026.20 still showed the bug, and nothing relevant changed on master after v2026.20 (68438b5e1). It is a real Metal-only transpose cause beside the by-design `mul(M,v)`→`v*M` swap on [[wiki/concepts/slang-backends-metal.md]]. Check for a native matrix vs `_MatrixStorage` in the MSL. User-side workarounds: declare the block as `ConstantBuffer<S>` instead of `ParameterBlock<S>`, or pass `-matrix-layout-row-major` (Metal and SPIR-V then agree). An unverified side note: a `float4x4` vertex input (`: WORLD`) is native on Metal but is decomposed as `_MatrixStorage_..._ColMajor` on SPIR-V, which may be a second mismatch [ParameterBlock matrix layout: ConstantBuffer<S> works around it; bad range starts at v2025.18.2](../learnings/1792404181097-metal-parameterblock-matrix-layout-bug-constantbuf.md).

**Source learnings (7):**
- [Metal lowering uses a one-operand makeVector(float4, packed_float4) as a conversion — don't count non-IRVectorType operands as scalars](../learnings/1790765098240-metal-lowering-uses-a-one-operand-makevector-float.md) — master's `c[i][0]` already miscompiles
- [Slang IR: a one-operand makeVector can be a Metal packed-vector conversion, not a lane list](../learnings/1790766506870-slang-ir-a-one-operand-makevector-can-be-a-metal-p.md) — match element types; test tests/metal/swizzle-of-packed-vector-load.slang
- [IR type-pointer equality misses IRAttributedType (unorm/snorm/no_diff); use unwrapAttributedType in peephole type checks](../learnings/1790769162592-ir-type-pointer-equality-misses-irattributedtype-u.md) — `getDataType()` strips only rate qualifiers; differential corpus compile caught a lost fold; `__vectorReshape<1>` trigger.
- [Metal ConstantBuffer ignores the L data-layout parameter (ScalarDataLayout) in both IR and reflection](../learnings/1791056669263-metal-constantbuffer-ignores-the-l-data-layout-par.md) — dropped silently, IR and reflection agree; fix both in lock step; verify offsets with -reflection-json.
- [Slang IR layout rule NAME is a lowering selector and leaks into MSL type names](../learnings/1791092001213-slang-ir-layout-rule-name-is-a-lowering-selector-a.md) — gates packing/struct clone/matrix lowering; `_natural`→`_default` identifiers; add a layout IR op; hand-edit stable names.
- [Metal ParameterBlock matrices ignore column_major since v2025.18.2 (transposed vs SPIR-V)](../learnings/1792157770273-metal-parameterblock-matrices-ignore-column-major-.md) — `MetalParameterBlockElementTypeLoweringPolicy::shouldLowerMatrixType` false + `[PhysicalType]` skip; WAR `-matrix-layout-row-major` (#13141)
- [Metal ParameterBlock matrix layout bug: ConstantBuffer<S> works around it, and the bad range starts at v2025.18.2](../learnings/1792404181097-metal-parameterblock-matrix-layout-bug-constantbuf.md) — v2025.18.1 good / v2025.18.2 bad, still bad at v2026.20; `ConstantBuffer<S>` or `-matrix-layout-row-major`; unverified `float4x4` vertex-input mismatch (#13141)

_Catalog: [[wiki/index.md]]_
