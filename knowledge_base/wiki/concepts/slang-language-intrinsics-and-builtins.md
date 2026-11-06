---
title: "Slang Intrinsics & Builtins"
type: concept
group: slang-language-core
tags: [intrinsics, builtins, spirv, groupshared, texture, gather, variable-pointers, flag-enum, coopvec, vector, capability-atoms, texture-shadow, prefix-expander, min-max, storage-buffer, GLSLShaderStorageBuffer, typealias]
source_count: 35
---

# Slang Intrinsics & Builtins

GPU intrinsics and builtin types are core-module declarations (`core.meta.slang`, `hlsl.meta.slang`, `glsl.meta.slang`); most bugs come from their per-target emit mapping and capability atoms.

## TL;DR

- **`$TR` in `__intrinsic_asm` emits the call's RETURN type; `$T<n>` emits operand n's type, unwrapping a texture to its element type.**
- **`__intrinsic_type`/`__intrinsic_op` are legal in user code** (E31229 covers three other modifiers); a bogus `__intrinsic_op(1000)` ICEs.
- **Emitter rules keyed on `intrinsicDefinition.startsWith(...)` also match user `__intrinsic_asm` text**: arity/type are filters (`return nullptr`), never asserts.
- **A `$N`-remapping marker (`$q`) must also be honored in `shouldFoldInstIntoUseSites`**, or args fold into every use.
- **Only the first `__intrinsic_asm` in a function body is emitted**, so a runtime `switch`/`if` over asm strings silently keeps one; write control flow as plain Slang.
- **`float(sign(x))` on SPIR-V is an unfolded `FSign; FToS; SToF` chain**; bare `FSign` changes the sign of zero — the exact rewrite is `FSign(x) + 0.0`.
- **Dot-form `__intrinsic_asm ".Method"` on a `void` method discards a value-returning op**; capture it (`this = __hlslSplat(t);`).
- **The `$P` prefix expander has no vector case**: generic `min`/`max` on a vector or matrix hits E99997.
- **Generic bodies are not re-resolved after specialization**, so a scalar-decomposition fallback costs generic callers the native op; use one target-aware `[ForceInline]` worker.
- **Builtin vector/matrix types ARE `DeclRefType<StructDecl>`**; `createInvokeExprForExplicitCtor` viability must not depend on `outExpr`.
- **`float4(float2 xy, 1.f)` is `(x,y,1,1)` (splat)**; the preserving rewrite is `float4(xy, 1.f, 1.f)`.
- **`|`/`&`/`^` work on `[Flags]` enums (via `ILogical`) but `|=`/`&=`/`^=` do not**; add generic compound ops over `T : ILogical` with `[OverloadRank(-10)]`.
- **The builtin-operator fast path shadows a user operator on builtin operands; the maintainer wants an ERROR**, via a predicate SHARED with the fast path.
- **`static_assert` is a builtin function, function-body only**; at global scope `ident(...)` mis-parses as a declaration.
- **`inverse` is GLSL/SPIR-V only; `determinant` is capped at 4×4 on CUDA/CPU.** N>4 matrices fail IR validation.
- **On SPIR-V most transcendental GLSL.std.450 ops are invalid on `double`, undiagnosed.** Gate with `static_assert` in a `__target_switch` case.
- **A gather offset branches on CONSTNESS** (`ConstOffset` vs `Offset`+`ImageGatherExtended`); a negated constant folds to a constant.
- **A `groupshared T[N]` PARAMETER lowered by-value loses TGSM on DXIL**: fix at parameter lowering (`BorrowInOut`); detect with `-target dxil-asm`.
- **Only the (GroupShared, parameter) arm of the variable-pointers signature walk is fail-without-fix.**
- **An instantiation-dependent capability cannot be a static `[require]`**; gate `__requireTargetExtension(...)` at emit time with a base atom in `[require]`.
- **E41012 for a `[require]` comes from the AST check in `slang-check-shader.cpp`, not `LateRequireCapability`**; also audit `glsl.meta.slang` `texelFetch` wrappers.
- **Renaming a shared capability atom is not neutral: ADD a new atom and RE-POINT**; public aliases need `///` docs + doc regen.
- **A family's latest-version atom is `getElements()[count-2]`** (`-1` is the stage atom). Capability predicates lack `SLANG_API`.
- **Single-struct SSBO today: `typealias RWStorageBuffer<T> = GLSLShaderStorageBuffer<T>;`** — omit the layout argument.
- **CPU/LLVM `half` is a fallback `struct half` with only `explicit operator float()`**; add explicit conversions, not `_Float16`.
- **A new texture access kind needs a case in EVERY emitter**; GLSL `image2D` IS `RWTexture2D<float>`, so key alias diagnostics on the spelling.

## `__intrinsic_asm` markers and dot-form methods

`$TR` emits the call's return type (`m_callInst->getDataType()`); `$T<n>` emits operand n's type and unwraps an `IRTextureType` to its element type — the usual element-vs-vector bug. On #12276 CUDA `Texture2D<float>.Gather` emitted `tex2Dgather<$T0>` = `tex2Dgather<float>` into a promised `float4` (NVRTC error); `tex2Dgather<$TR>` gives `vector<T.Element,4>` (repro `slangc -target ptx`) [$TR emits the return type](../learnings/1785372605179-intrinsic-asm-tr-marker-emits-the-call-return-type.md).

A dot-prefix `__intrinsic_asm ".Method"` on a `[mutating] void` method emits `receiver.Method(args)` as a bare statement and drops its value: on #12059 HLSL `Matrix::Splat(T)` returns one, so `CoopMat.fill(t)` left the destination uninitialized (PSO-creation crash). The fix, like `__hlslLoadBAB`, is an `internal static This` helper wrapping `$TR::Splat($0)`, used as `this = __hlslSplat(t);` [dot-form Splat discards value (#12059)](../learnings/1783725139961-slang-12059-hlsl-coopmat-fill-splat-dot-form-intri.md).

**Only the first `__intrinsic_asm` string in a function is emitted.** It lowers to an `IRGenericAsm` block terminator, and `findTargetIntrinsicDefinition` (slang-ir.cpp:9949) returns the FIRST such block, so a runtime `switch`/`if` around several strings (a wave-size switch in `subgroupInverseBallot`, #14250) emits only the first. `subgroupBallotBitExtract` with an index >= `gl_SubgroupSize` is undefined (Vulkan returns 0 on 32 lanes), so GPU tests must not assert those lanes [only the first __intrinsic_asm is emitted; GLSL-source VK tests run 1 thread/group](../learnings/1793740104470-slang-only-the-first-intrinsic-asm-in-a-core-modul.md). The GLSL-source Vulkan test trap is on [[wiki/concepts/slang-language-glsl-layout-qualifiers-and-late-entry-points.md]].

## Intrinsic modifiers in user code; text-keyed emitter rules

E31229 (#12538) rejects only `__magic_type`, `__builtin_type` and `__builtin_requirement` outside the core module; standard modules use `__intrinsic_type`/`__intrinsic_op` without `FromCoreModuleModifier`, so an `isFromCoreModule`-only gate would break them. `parseIROp` does not range-check: `__intrinsic_op(1000)` gives E99997 (Debug) or "Unhandled local inst in spirv-emit" (Release). The "never used by an application" sentence is in shader-slang/spec (`introduction-language-evolution.md:83-84`), so changing it needs a spec PR [intrinsic modifiers legal in user code](../learnings/1792065241922-intrinsic-type-intrinsic-op-are-accepted-in-user-c.md).

So `emitIntrinsicCallExprImpl` sees user text too, and a rule keyed on `intrinsicDefinition.startsWith("<builtin>")` matches it. On #13670 a reviewer turned the filter `&& inst->getArgCount() == 1` into `SLANG_RELEASE_ASSERT`; a valid two-arg user `__intrinsic_asm "unpack2x16float(($0) | (($1) << 16u))"` then hit E99997, and a one-arg `int` user intrinsic got a `u32`-only WGSL helper Tint rejects. Arity and operand type are preconditions (`return nullptr` otherwise), even with exact-string matching; pin with a revert-drilled same-prefix row [prefix rules filter, not assert](../learnings/1792104381131-emitter-rules-keyed-on-an-intrinsic-string-prefix-.md).

`CLikeSourceEmitter::shouldFoldInstIntoUseSites` also reads intrinsic text, counting `$N` uses by raw operand index. A remapping marker like `$q` (skips the split-out sampler at operand 1 of a combined texture-sampler) must be honored there, or a multiply-used argument looks unused and folds into every use: 5 chained combined-sampler `Load`s on Metal/WGSL produced 121 texture reads. #13741 adds one shared `getIntrinsicArgOperandIndex()` (slang-intrinsic-expand.cpp) for both readers [$q in the fold heuristic](../learnings/1792284128530-q-intrinsic-strings-must-also-be-understood-by-the.md).

## `sign()` round-trip on SPIR-V (#13676)

HLSL `sign()` returns `int`, so float `sign` lowers to one opaque `spirv_asm { FSign; OpConvertFToS }`, and `float(sign(x))` adds an `OpConvertSToF` nobody folds. The round-trip yields only {-1, +0, +1}; bare `FSign` returns -0.0 for -0.0 and ±1/±0 for NaN, so folding to it changes the sign of zero (fast-math-only, #12405); spirv-opt drops the exact `FSign(x) + 0.0` at -O1+ unless `NoContraction`/float-controls apply. For an IR peephole to see the casts, split a `[__readNone]` FSign-only asm helper plus `__float_to_int_cast`, ForceInline the wrapper, and recognize the helper via `KnownBuiltinDeclName` + `getBuiltinFuncEnum`. GLSL mode has no float `sign`, so GLSL `sign(x)/2` becomes integer `OpSDiv` (a bug) [sign() round-trip (#13676)](../learnings/1792095513009-float-int-fsign-x-fsign-x-0-0-exactly-spirv-opt-fo.md).

## `$P` and generic vector/matrix `min`/`max` (#11075, PR #12249)

A generic `T:IFloat`/`IComparable` `min`/`max` on a vector ICEs (E99997) on `-target cpp`/`cuda` (regression from #9593): concrete overloads decompose via `VECTOR_MAP_BINARY`, but the generic path emits one whole-vector `$P_min`, and `case 'P'` in `slang-intrinsic-expand.cpp` has no vector case. A meta.slang-only fix fails; the authorized fix unwraps `IRVectorType` before the switch, adds vector-arity prelude helpers (CPU `template<int N>`, CUDA 2/3/4), and folds the `kIROp_IsVector` peephole on the pre-unwrap type; `slang-embed` follows `#include` (prelude edits need a fresh worktree) [$P vector min/max fix layer](../learnings/1785207760204-slang-p-prefix-vector-min-max-fix-layer-prelude-em.md). The matrix sibling (`$P_max` on a matrix falls to `default:`) is pre-existing and out of scope [matrix sibling crash](../learnings/1785210150352-slang-p-vector-min-max-fix-leaves-matrix-sibling-c.md). Round 2's `E55215` in `default:` misses prefixed element types lacking a vector helper (`intptr_t`→IPTR, `int16_t`→I16: "undeclared identifier"); APPROVE_WITH_NITS [E55215 misses prefixed types](../learnings/1785214611295-slang-12249-round-2-e55215-diagnostic-misses-prefi.md).

**A scalar-decomposition fallback overload costs generic callers the native op.** A low-rank broad `min<T:__BuiltinArithmeticType, let N:int>(vector<T,N>, vector<T,N>)` with a `VECTOR_MAP_BINARY` body is fine for concrete callers, but generic bodies aren't re-resolved after specialization, so generic callers get per-element scalar ops (no SPIR-V `FMin`/`SMin`, no HLSL `min`). The maintainer's #13139 (closing #13114) routes the int, float and broad families through shared target-aware `[ForceInline]` workers (`__vectorMinImpl`, `__matrixMinImpl`), so all get native ops and matrices keep `MatrixLayoutMode` [broad overload loses native ops](../learnings/1790642295187-slang-core-module-a-broad-generic-overload-that-de.md).

## Builtin vector types and constructor resolution

Builtin vector/matrix types are `DeclRefType<StructDecl>`, so init-list coercion goes through `createInvokeExprForExplicitCtor` (struct branch of `_coerceInitializerList`), not `createCtorInvokeExprForAbstractType`. On #11730 its viability `return true` sat under `if (outExpr)`, and the `canCoerce` probe passes null, so `{float2, float}` failed as an argument but worked in a declaration [builtin vector is DeclRefType<StructDecl> (#11730)](../learnings/1782733705823-slang-11730-builtin-vector-is-a-declreftype-lt-str.md).

`float4(float2 barycentrics, 1.f)` splats `1.f` and resolves `__init(vector<T,2> xy, vector<T,2> zw)` → `(x,y,1,1)`, not a tail-pad. The slang-rhi#798 fix `float4(barycentrics, 1.f, 1.f)` gives the same value via `__init(vector<T,2>, T, T)` and unblocks #12141, whose `static_assert(false)` on `vector<T,4>`'s `(vec2,T)` ctors would make the call E41400 [float4(float2,1.f) splat (slang-rhi#798)](../learnings/1784281175141-slang-rhi-798-float4-float2-1-f-splat-vs-tail-pad-.md). The design-gated divergence is #12093; see [[wiki/concepts/slang-language-generics-and-type-system.md]].

## Single-struct SSBO via `GLSLShaderStorageBuffer<T>` (#11028)

#11028 (open) asks for `RWStorageBuffer<T>`/`StorageBuffer<T>` as a single-struct SSBO. Today the hidden `GLSLShaderStorageBuffer<T, L = DefaultDataLayout>` (`hlsl.meta.slang:73-77`) via `typealias RWStorageBuffer<T> = GLSLShaderStorageBuffer<T>;` gives `buf.field` with no `[0]`. Compile-only on v2026.20: SPIR-V a std430 StorageBuffer `Block` (spirv-val clean); GLSL `layout(std430) buffer`; HLSL/WGSL a structured/storage array indexed `[0]`; Metal `device*`; CUDA compiles. An explicit `Std430DataLayout` compiles only on SPIR-V/GLSL (others E36107). No read-only variant yet [SSBO via GLSLShaderStorageBuffer typealias](../learnings/1792916435475-non-array-storage-buffer-today-typealias-over-hidd.md).

## Builtin operators: fast path, shared predicates, and flag enums

Since #11493, `convertToBuiltinArithmeticOp` rewrites `a OP b` on builtin operands to a `BuiltinOperatorExpr` before overload resolution, silently dropping a user `operator*(float4x4,float4x4)` (#11877); the maintainer wants that declaration to be an error [fast path: maintainer wants ERROR](../learnings/1784156401458-slang-11493-fast-path-user-operator-on-builtin-ope.md). PR #12162 (`pr: breaking change`) adds the declaration-site diagnostic, which must reject exactly what the fast path shadows; reviewers gated it on collapsing the thrice-written element-eligibility ladder (bitwise/shift→int; equality→int|float|bool; logical-not→bool; arithmetic→int|float) into one `isBuiltinOperationKindEligibleForBaseType(BuiltinOperationKind, BaseType)` beside `getBuiltinOperationKindFromString`. Use explicit cases plus `[[noreturn]]` `SLANG_UNEXPECTED`, not a plausible `default:`; test the `this`-receiver branch most [share the fast-path predicate](../learnings/1784627727954-slang-when-a-check-must-mirror-the-fast-path-share.md).

Binary `|`, `&`, `^` work on `[Flags]` enums because they are generic over `T : ILogical`, which enums conform to; the compound forms come from `kCompoundBinaryOps`, constrained on `__BuiltinLogicalType`, which enums don't. The fix adds generic `operator|=/&=/^=` over `T : ILogical` in `core.meta.slang` with `[OverloadRank(-10)]` (no ambiguity for builtin integers); `a |= b` resolves by named-function overload lookup, not a desugar [flag-enum compound-assign gap](../learnings/1781621242788-slang-flag-enum-compound-assign-gap-ilogical-vs-bu.md).

## `static_assert`, matrix inverse/determinant, and fp64 on SPIR-V

**`static_assert` is function-body only (#13208).** It is a builtin function (`__intrinsic_op(kIROp_StaticAssert)`), not a keyword. At module scope it parses as a type name, `(` commits to a function declarator, and the arguments fail with a misleading `unexpected '(', expected ')'`; with no decl→expr backtrack, any global `ident(...)` mis-parses. Any-scope support is #6136 (syntax-decl plus module-level `kIROp_StaticAssert`; the emit-time checker already recurses the module) [static_assert is function-body only](../learnings/1790019025315-slang-static-assert-is-a-builtin-intrinsic-fn-func.md).

**Inverse and determinant.** On master 01dcd3568 the only `inverse(matrix<T,N,N>)` is `glsl.meta.slang:894`, `[require(glsl, GLSL_400)] [require(spirv)]` — no other target, no derivative. `determinant` (`hlsl.meta.slang:10513`) is native on HLSL, GLSL, SPIR-V, Metal and WGSL, with a `static_assert(N<=4)` CUDA/CPU fallback and both derivatives. Vectors >4 fail IR validation (E38206), so `matrix<float,12,12>` fails everywhere. Slang has no portable matrix inverse (#14020, #14009 / PR #14012) [inverse/determinant targets](../learnings/1793284894132-slang-matrix-inverse-is-glsl-spir-v-only-determina.md).

**fp64 GLSL.std.450 ops (#14061)**, measured per function under `SLANG_RUN_SPIRV_VALIDATION=1` (ToT 977df1246). **Invalid on `double`, no slangc diagnostic:** sin, cos, tan, asin, acos, atan, atan2, sinh, cosh, tanh, asinh, acosh, atanh, exp, exp10, log, log2, log10, pow, radians, degrees, sincos; exp2 and ldexp on vectors (spirv-val `validate_extensions.cpp:1611-1631`). **Silently narrowed:** scalar exp2 and ldexp go through float — valid but lossy (hlsl.meta.slang:11362), as DXC does. **Valid:** sqrt/rsqrt, rounding (floor/ceil/round/trunc/frac), abs, sign, saturate, rcp, fmod, min/max/clamp/step/lerp/smoothstep, fma/mad, modf, and the geometric ops (length…faceforward). `[require]` cannot gate on a generic type argument; the working pattern is `static_assert(!__isHalf<T>(), "...")` in a `__target_switch` case (hlsl.meta.slang:2347), checked post-specialization by `checkStaticAssert`. No `__isDouble` yet; `T is double` works in user code [SPIR-V fp64 math ops](../learnings/1793312363687-slang-spir-v-fp64-math-which-glsl-std-450-ops-are-.md).

## Texture access kinds, gather offsets, and TGSM

**Access kinds (#13536).** Texture access is `kCoreModule_ResourceAccess*` 0-4 and emitters don't reject unhandled values (GLSL/WGSL fall into sampled `texture`; the SPIR-V `Sampled` switch has no default), so a new kind (`RTexture*`) needs a case in each. GLSL `image2D` is the same type as `RWTexture2D<float>` (`_Texture`, access 1), so a `readonly RWTexture*` diagnostic must key on the spelled alias; `readonly` on `RWTexture2D` only emits `NonWritable` and stores still compile. `WTexture2DMS` is missing because the alias generator (`hlsl.meta.slang:6130`) compares access to a shape constant [texture access kinds need every emitter](../learnings/1791500273983-slang-texture-access-kinds-adding-one-needs-every-.md).

**Gather offsets (#9382).** `Texture2D.Gather(s, uv, int2(2,1))` emits SPIR-V `Offset` plus `ImageGatherExtended` instead of `ConstOffset`; GLSL `textureGatherOffset` can pass a runtime offset through the same intrinsic, so branch on constness rather than switch wholesale [Gather ConstOffset: naive fix unsafe](../learnings/1781713033202-slang-9382-gather-constoffset-naive-fix-unsafe-two.md). A negated constant (`-int2(2,1)`) is `Neg(MakeVector(...))` at spirv-legalize but later folds to `int2(-2,-1)` and takes `ConstOffset`, with the capability lingering (pre-existing); asserting `Offset`+capability for it would lock in the bug [negated constant offset folds (#9382)](../learnings/1781731175811-slang-9382-negated-constant-gather-offset-int2-2-1.md).

**GroupShared / TGSM on DXIL (#10641).** A `groupshared T scratch[N]` parameter, unlike a global, was lowered by-value (`In`) in `getExplicitlyDeclaredParamPassingMode`: a per-thread `alloca` without `addrspace(3)` on DXIL, so sharing silently failed [groupshared param loses TGSM](../learnings/1782228288994-groupshared-array-parameter-lowered-by-value-loses.md). PR #11709 lowers bare `groupshared` params to `BorrowInOut`; the HLSL emitter strips the DXC-illegal `groupshared inout` except on mesh payload params (`in payload`). `specializeAddressSpace` on DXIL was falsified as the fix layer [fix is by-reference lowering](../learnings/1782228568362-slang-10641-groupshared-array-param-bug-fix-is-by-.md). GPU-free repro: `slangc -target dxil-asm` — zero `addrspace(3)` globals plus `alloca [N x ...]` proves it, a plain groupshared global the positive control [detect TGSM bugs via dxil-asm](../learnings/1782216962036-detect-groupshared-tgsm-codegen-bugs-on-dxil-witho.md).

**Variable pointers (SPIR-V, PR #11521).** `requireFunctionTypeCapabilitiesIfNeeded(IRFuncType*)` (from `emitFunc`) declares `SPV_KHR_variable_pointers`/`VariablePointers` for a `Workgroup`/`StorageBuffer` pointer surviving only in a non-inlined signature. Only (GroupShared, parameter) fails without it — `emitCall` covers the result arm, `emitGetOffsetPtr`/`emitGetElement` cover `StorageBuffer` — so document that rather than add passing tests [only (GroupShared, parameter) fails](../learnings/1780972705906-slang-variable-pointers-signature-walk-fix-only-gr.md).

## Capability atoms on texture methods and E41012

A static `[require]` cannot see a generic `let isCombined`, so a bare-vs-combined-sampler capability is gated with `__requireTargetExtension(...)` at emit time, keeping a base atom (`texture_sm_4_1`) in `[require]` as `GetDimensions` does. `Texture.Load`'s unconditional `texture_sm_4_1_samplerless` `[require]` disagreed with its gated `if(isCombined==0)` GLSL emission, firing spurious E41012 (ProfileImplicitlyUpgraded) on combined samplers under `-profile` [spurious E41012: static [require] vs isCombined](../learnings/1782889962730-spurious-e41012-profile-upgrade-warning-static-req.md). The warning comes from the AST check in `slang-check-shader.cpp` (only on an explicit capability/profile request), not IR `LateRequireCapability` (only `__requireCapability`), and the AST path cannot see generic lets [E41012 comes from slang-check-shader.cpp](../learnings/1782895560951-e41012-from-a-require-attribute-comes-from-slang-c.md). It fires for any `[require]`-annotated inlined FuncDecl, so the `[ForceInline]` `texelFetch(...)` wrappers in `glsl.meta.slang`, with their own samplerless `[require]`, need the same audit as `.Load`/subscript. Dropping a stdlib atom can flip generated "DO NOT EDIT" `-restrictive-capability-check` tests red→green; fix the generator and regenerate [also check glsl.meta.slang texelFetch wrappers](../learnings/1782898835005-fixing-a-capability-require-atom-on-a-texture-meth.md).

**Shadow-texture atoms (#12244).** The `GL_EXT_texture_shadow_lod` bias boundary is narrower than its LOD one: bias `texture`/`textureOffset` is core GLSL 1.50 for `sampler1D/1DArray/2DShadow` and `samplerCubeShadow`, the extension adds only `sampler2DArrayShadow`/`samplerCubeArrayShadow` bias, and `textureGrad*` on shadow samplers is core. `SampleCmpLevel` is SM6.7, `SampleCmpBias`/`SampleCmpGrad` SM6.8 [shadow_lod bias ≠ LOD boundary](../learnings/1785190567550-gl-ext-texture-shadow-lod-bias-form-boundary-expli.md). Renaming `texture_shadowlod`→`texture_shadow` is wrong because the atom is shared (~14 `SampleCmp*` sites, ~57 GLSL `textureLod`/`texture` overloads): add `texture_shadow`/`texture_shadowbias` equal to the current expansions and re-point only the SampleCmp methods; a new public alias needs `///` docs and a doc regen [SampleCmp atom: re-point, not rename](../learnings/1785192528373-samplecmp-capability-atom-rename-re-point-not-rena.md).

## Capability system internals, and CPU `half`

A family's latest version atom from a `_*_latest` alias is `elements[elements.getCount() - 2]` (as in `getLatestSpirvAtom()`/`getLatestMetalAtom()`), because the alias's `CapabilitySet` includes a stage atom sorting above all version atoms (max-atom scans grab it; gap-walks segfault). `isSpirvExtensionAtom` and the family predicates lack `SLANG_API`, so test via `.slang`, not `slang-unit-test` [latest-version atom = count-2](../learnings/1784424625402-slang-capability-latest-version-atom-helper-must-u.md).

Capability RFC #9210 facts (@33f9ed0ce): `__requireCapability(...)` → `RequireCapabilityStmt`; no generic `IRRequireTargetCapability` op; `[require]` is `RequireCapabilityAttribute`, propagated by `_propagateRequirement` with the caller-⊇-callee `CapabilitySet::checkCapabilityRequirement`; `CapabilitySet` is a disjunction of conjunctions (`CapabilityTargetSets → CapabilityStageSets → CapabilityAtomSet`); compound capabilities are capdef `alias`es. #11631/#11903 corroborate it. Park it while owners debate (neutral 5-bullet, no fixer dispatch) [capability RFC #9210 facts](../learnings/1783523347890-slang-capability-rfc-9210-current-system-facts-tha.md).

**CPU/LLVM `half` (#11996).** `SLANG_LLVM` gates out the native `_Float16` block in `prelude/slang-cpp-scalar-intrinsics.h`, so CPU/LLVM `half` is the fallback `struct half` with only `explicit operator float()`. `(int8_t)half` emits `int8_t(halfValue)`, which fails since an explicit operator doesn't chain (`(int8_t)(float)h` compiles). Approach A adds `explicit` int8-64/double/bool operators via `load()`; native `_Float16` on LLVM is rejected (unsupported on some host triples) [CPU half has only operator float (#11996)](../learnings/1783511746989-slang-cpu-half-struct-has-only-operator-float-half.md).

## Supersessions

Falsified: vectors take the abstract-type ctor path (#11730); a negated constant gather offset stays runtime `OpSNegate` (#9382); `specializeAddressSpace` on DXIL fixes groupshared params (#10641).

**Source learnings (35):**
- [`__intrinsic_type`/`__intrinsic_op` legal in user code](../learnings/1792065241922-intrinsic-type-intrinsic-op-are-accepted-in-user-c.md) — E31229 covers three others; bogus opcode ICEs
- [intrinsic-prefix emitter rules filter arity/type, never assert](../learnings/1792104381131-emitter-rules-keyed-on-an-intrinsic-string-prefix-.md) — revert-drilled row
- [`float(sign(x))` == `FSign(x)+0.0`; signed-zero hazard (#13676)](../learnings/1792095513009-float-int-fsign-x-fsign-x-0-0-exactly-spirv-opt-fo.md) — peephole needs casts outside asm
- [`static_assert` function-body only (#13208)](../learnings/1790019025315-slang-static-assert-is-a-builtin-intrinsic-fn-func.md) — any-scope is #6136
- [latest-version atom = `count-2`](../learnings/1784424625402-slang-capability-latest-version-atom-helper-must-u.md) — predicates lack `SLANG_API`
- [`float4(float2,1.f)` splats to (x,y,1,1)](../learnings/1784281175141-slang-rhi-798-float4-float2-1-f-splat-vs-tail-pad-.md) — slang-rhi#798
- [only (GroupShared, parameter) is fail-without-fix](../learnings/1780972705906-slang-variable-pointers-signature-walk-fix-only-gr.md) — #11521
- [flag-enum compound assign gap](../learnings/1781621242788-slang-flag-enum-compound-assign-gap-ilogical-vs-bu.md) — `ILogical` vs `__BuiltinLogicalType`
- [Gather ConstOffset: branch on constness](../learnings/1781713033202-slang-9382-gather-constoffset-naive-fix-unsafe-two.md) — #9382
- [negated constant offset folds to ConstOffset](../learnings/1781731175811-slang-9382-negated-constant-gather-offset-int2-2-1.md) — #9382
- [GPU-free TGSM detection](../learnings/1782216962036-detect-groupshared-tgsm-codegen-bugs-on-dxil-witho.md) — `-target dxil-asm`
- [groupshared param lowered by-value loses TGSM](../learnings/1782228288994-groupshared-array-parameter-lowered-by-value-loses.md) — #10641
- [fix is `BorrowInOut` lowering](../learnings/1782228568362-slang-10641-groupshared-array-param-bug-fix-is-by-.md) — address-space fix falsified
- [builtin vector is `DeclRefType<StructDecl>`](../learnings/1782733705823-slang-11730-builtin-vector-is-a-declreftype-lt-str.md) — `if(outExpr)` guard bug (#11730)
- [spurious E41012: static samplerless `[require]`](../learnings/1782889962730-spurious-e41012-profile-upgrade-warning-static-req.md) — vs `isCombined` gate
- [E41012 from slang-check-shader.cpp](../learnings/1782895560951-e41012-from-a-require-attribute-comes-from-slang-c.md) — not `LateRequireCapability`
- [also fix glsl.meta.slang `texelFetch` wrappers](../learnings/1782898835005-fixing-a-capability-require-atom-on-a-texture-meth.md) — regen DO-NOT-EDIT tests
- [capability RFC #9210 system facts](../learnings/1783523347890-slang-capability-rfc-9210-current-system-facts-tha.md) — park under owner debate
- [CPU `half` has only `operator float`](../learnings/1783511746989-slang-cpu-half-struct-has-only-operator-float-half.md) — #11996
- [dot-form `Splat` discards value](../learnings/1783725139961-slang-12059-hlsl-coopmat-fill-splat-dot-form-intri.md) — capture with `this = ...` (#12059)
- [fast path shadows user operator; maintainer wants ERROR](../learnings/1784156401458-slang-11493-fast-path-user-operator-on-builtin-ope.md) — #11877
- [share `isBuiltinOperationKindEligibleForBaseType`](../learnings/1784627727954-slang-when-a-check-must-mirror-the-fast-path-share.md) — #12162
- [shadow_lod bias boundary ≠ LOD boundary](../learnings/1785190567550-gl-ext-texture-shadow-lod-bias-form-boundary-expli.md) — SampleCmp SM6.7/6.8
- [SampleCmp atom: add and re-point, not rename](../learnings/1785192528373-samplecmp-capability-atom-rename-re-point-not-rena.md) — #12244
- [`$P` vector min/max fix layer](../learnings/1785207760204-slang-p-prefix-vector-min-max-fix-layer-prelude-em.md) — prelude embedding (#11075/#12249)
- [matrix sibling crash, out of vector scope](../learnings/1785210150352-slang-p-vector-min-max-fix-leaves-matrix-sibling-c.md) — #12249
- [E55215 misses prefixed element types](../learnings/1785214611295-slang-12249-round-2-e55215-diagnostic-misses-prefi.md) — #12249
- [`$TR` emits the call return type](../learnings/1785372605179-intrinsic-asm-tr-marker-emits-the-call-return-type.md) — #12276
- [broad scalar-decomposition overload loses native ops](../learnings/1790642295187-slang-core-module-a-broad-generic-overload-that-de.md) — shared worker (#13139)
- [new access kind needs every emitter](../learnings/1791500273983-slang-texture-access-kinds-adding-one-needs-every-.md) — image2D == RWTexture2D (#13536)
- [`$q` in `shouldFoldInstIntoUseSites`](../learnings/1792284128530-q-intrinsic-strings-must-also-be-understood-by-the.md) — one shared helper (#13741)
- [SSBO via `GLSLShaderStorageBuffer<T>` typealias](../learnings/1792916435475-non-array-storage-buffer-today-typealias-over-hidd.md) — omit layout (#11028)
- [`inverse` GLSL/SPIR-V only; `determinant` 4×4 cap](../learnings/1793284894132-slang-matrix-inverse-is-glsl-spir-v-only-determina.md) — #14020, #14009
- [fp64 GLSL.std.450 invalid/narrowed ops](../learnings/1793312363687-slang-spir-v-fp64-math-which-glsl-std-450-ops-are-.md) — gate via `static_assert` (#14061)
- [only the first `__intrinsic_asm` in a function is emitted](../learnings/1793740104470-slang-only-the-first-intrinsic-asm-in-a-core-modul.md) — #14250; ballot index UB

_Catalog: [[wiki/index.md]]_
