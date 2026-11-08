---
title: "Slang Intrinsics & Builtins"
type: concept
group: slang-language-core
tags: [intrinsics, builtins, spirv, groupshared, texture, gather, variable-pointers, flag-enum, coopvec, vector, capability-atoms, texture-shadow, prefix-expander, min-max, storage-buffer, GLSLShaderStorageBuffer, typealias]
source_count: 39
---

# Slang Intrinsics & Builtins

GPU intrinsics and builtin types are core-module declarations (`core.meta.slang`, `hlsl.meta.slang`, `glsl.meta.slang`); most bugs come from their per-target emit mapping and capability atoms.

## TL;DR

- **`$TR` in `__intrinsic_asm` emits the call's RETURN type; `$T<n>` emits operand n's type, unwrapping a texture to its element.**
- **`__intrinsic_type`/`__intrinsic_op` are legal in user code** (E31229 covers three other modifiers).
- **Emitter rules keyed on an intrinsic-string prefix also match user `__intrinsic_asm`**: arity/type filter (`return nullptr`), never assert.
- **Honor `$N`-remapping markers (`$q`) in `shouldFoldInstIntoUseSites` too**, or args fold into every use.
- **Only the first `__intrinsic_asm` in a function is emitted**; write runtime control flow as plain Slang.
- **`float(sign(x))` on SPIR-V equals `FSign(x) + 0.0`**, not bare `FSign` (sign of zero).
- **Dot-form `".Method"` asm on a `void` method drops the value**; capture it (`this = __hlslSplat(t);`).
- **`$P` has no vector case** (generic vector `min`/`max` → E99997); a scalar fallback costs generic callers the native op — use one target-aware `[ForceInline]` worker.
- **Builtin vectors/matrices ARE `DeclRefType<StructDecl>`**; ctor viability must not depend on `outExpr`.
- **`float4(float2 xy, 1.f)` splats to `(x,y,1,1)`**; write `float4(xy, 1.f, 1.f)`.
- **Generic `T : ILogical` operators cover `& | ^ ~ ! && || &= |= ^=` but not shifts**: `<< >>` are `__BuiltinIntegerType`-only (E39999); write `x.shr(int(n))`.
- **Generic `ILogical` operators steal `bool` operands** (cost 1 < BoolToInt 120): promote `bool << n` to int in `convertToBuiltinArithmeticOp`. `enum : bool` shifts ICE.
- **A user operator the builtin fast path shadows should be an ERROR**, via a predicate SHARED with the fast path.
- **`static_assert` is a builtin function, function-body only.**
- **`inverse` is GLSL/SPIR-V only; `determinant` is ≤4×4 on CUDA/CPU.**
- **Most transcendental GLSL.std.450 ops are invalid on SPIR-V `double`, undiagnosed**; gate with `static_assert` in a `__target_switch` case.
- **Gather offsets branch on CONSTNESS** (`ConstOffset` vs `Offset`+`ImageGatherExtended`).
- **`groupshared T[N]` parameters must lower `BorrowInOut`** or lose TGSM on DXIL; detect with `-target dxil-asm`.
- **Only the (GroupShared, parameter) variable-pointers arm is fail-without-fix.**
- **An instantiation-dependent capability is `__requireTargetExtension(...)` at emit time, base atom in `[require]`.** E41012 comes from `slang-check-shader.cpp`; audit `texelFetch` wrappers too.
- **Never rename a shared capability atom: ADD and RE-POINT**; public aliases need `///` docs + doc regen.
- **The latest-version atom is `getElements()[count-2]`**; capability predicates lack `SLANG_API`.
- **Single-struct SSBO today: `typealias RWStorageBuffer<T> = GLSLShaderStorageBuffer<T>;`**
- **CPU/LLVM `half` has only `explicit operator float()`**; add explicit conversions, not `_Float16`.
- **A new texture access kind needs a case in EVERY emitter**; `image2D` IS `RWTexture2D<float>`.

## `__intrinsic_asm` markers and dot-form methods

On #12276 CUDA `Texture2D<float>.Gather` emitted `tex2Dgather<$T0>` (`float`) into a promised `float4`; `tex2Dgather<$TR>` fixes it (repro `slangc -target ptx`) [#12276](../learnings/1785372605179-intrinsic-asm-tr-marker-emits-the-call-return-type.md).

A dot-prefix `__intrinsic_asm ".Method"` on a `[mutating] void` method emits `receiver.Method(args)` as a statement: on #12059 HLSL `Matrix::Splat(T)`'s result was dropped, so `CoopMat.fill(t)` left the destination uninitialized. Fix (as `__hlslLoadBAB`): an `internal static This` helper wrapping `$TR::Splat($0)`, used as `this = __hlslSplat(t);` [#12059](../learnings/1783725139961-slang-12059-hlsl-coopmat-fill-splat-dot-form-intri.md).

**First asm only (#14250).** `__intrinsic_asm` lowers to an `IRGenericAsm` block terminator and `findTargetIntrinsicDefinition` (slang-ir.cpp:9949) returns the first, so a runtime `switch` over strings (`subgroupInverseBallot` wave size) keeps one. `subgroupBallotBitExtract` with index >= `gl_SubgroupSize` is undefined, so GPU tests must not assert those lanes [first asm](../learnings/1793740104470-slang-only-the-first-intrinsic-asm-in-a-core-modul.md). GLSL-source Vulkan test trap: [[wiki/concepts/slang-language-glsl-layout-qualifiers-and-late-entry-points.md]].

## Intrinsic modifiers in user code; text-keyed emitter rules

E31229 (#12538) rejects only `__magic_type`, `__builtin_type`, `__builtin_requirement` outside the core module; standard modules use `__intrinsic_type`/`__intrinsic_op` without `FromCoreModuleModifier`, so an `isFromCoreModule`-only gate breaks them. `parseIROp` does not range-check (`__intrinsic_op(1000)` is E99997). Changing the spec's "never used by an application" sentence (`introduction-language-evolution.md:83-84`) needs a spec PR [user-code modifiers](../learnings/1792065241922-intrinsic-type-intrinsic-op-are-accepted-in-user-c.md).

So `emitIntrinsicCallExprImpl` sees user text: on #13670 turning the filter `&& inst->getArgCount() == 1` into `SLANG_RELEASE_ASSERT` made a valid two-arg user `__intrinsic_asm "unpack2x16float(($0) | (($1) << 16u))"` hit E99997. Arity and operand type are preconditions (`return nullptr`) even with exact-string matching; pin with a revert-drilled same-prefix row [filter, not assert](../learnings/1792104381131-emitter-rules-keyed-on-an-intrinsic-string-prefix-.md).

`CLikeSourceEmitter::shouldFoldInstIntoUseSites` counts `$N` uses by raw operand index. A remapping marker like `$q` (skips a combined texture-sampler's split-out sampler) must be honored there, or a multiply-used arg folds into every use (5 chained `Load`s on Metal/WGSL gave 121 texture reads). #13741 adds one shared `getIntrinsicArgOperandIndex()` (slang-intrinsic-expand.cpp) for both readers [$q fold](../learnings/1792284128530-q-intrinsic-strings-must-also-be-understood-by-the.md).

## `sign()` round-trip on SPIR-V (#13676)

HLSL `sign()` returns `int`, so float `sign` is one opaque `spirv_asm { FSign; OpConvertFToS }` plus an unfolded `OpConvertSToF`. The round-trip yields only {-1, +0, +1}; bare `FSign` keeps -0.0 and NaN signs, so folding to it is fast-math-only (#12405); spirv-opt drops `+ 0.0` at -O1+ unless `NoContraction`/float-controls apply. For a peephole to see the casts, split a `[__readNone]` FSign-only asm helper plus `__float_to_int_cast`, ForceInline the wrapper, and match the helper via `KnownBuiltinDeclName` + `getBuiltinFuncEnum`. GLSL mode has no float `sign`, so GLSL `sign(x)/2` becomes integer `OpSDiv` (a bug) [sign](../learnings/1792095513009-float-int-fsign-x-fsign-x-0-0-exactly-spirv-opt-fo.md).

## Vector/matrix `min`/`max` (#11075, PR #12249, #13139)

A generic `T:IFloat`/`IComparable` vector `min`/`max` ICEs on `-target cpp`/`cuda` (regression from #9593): it emits one whole-vector `$P_min`. A meta.slang-only fix fails; the authorized fix in `slang-intrinsic-expand.cpp` unwraps `IRVectorType` before the switch, adds vector-arity prelude helpers (CPU `template<int N>`, CUDA 2/3/4), and folds the `kIROp_IsVector` peephole on the pre-unwrap type; `slang-embed` follows `#include`, so prelude edits need a fresh worktree [$P fix](../learnings/1785207760204-slang-p-prefix-vector-min-max-fix-layer-prelude-em.md). The matrix sibling (`$P_max` falls to `default:`) is pre-existing and out of scope [matrix](../learnings/1785210150352-slang-p-vector-min-max-fix-leaves-matrix-sibling-c.md). Round 2's `E55215` in `default:` misses prefixed element types lacking a vector helper (`intptr_t`, `int16_t`) [E55215](../learnings/1785214611295-slang-12249-round-2-e55215-diagnostic-misses-prefi.md).

A low-rank broad `min<T:__BuiltinArithmeticType, let N:int>` with a `VECTOR_MAP_BINARY` body leaves generic callers per-element scalar ops (no SPIR-V `FMin`/`SMin`). #13139 (closing #13114) routes all families through shared target-aware `[ForceInline]` workers (`__vectorMinImpl`, `__matrixMinImpl`), keeping native ops and `MatrixLayoutMode` [native ops](../learnings/1790642295187-slang-core-module-a-broad-generic-overload-that-de.md).

## Builtin vector types and constructor resolution

Init-list coercion of a builtin vector goes through `createInvokeExprForExplicitCtor` (struct branch of `_coerceInitializerList`), not `createCtorInvokeExprForAbstractType`. On #11730 its viability `return true` sat under `if (outExpr)`, and the `canCoerce` probe passes null, so `{float2, float}` failed as an argument but worked in a declaration [#11730](../learnings/1782733705823-slang-11730-builtin-vector-is-a-declreftype-lt-str.md).

`float4(float2 barycentrics, 1.f)` resolves `__init(vector<T,2> xy, vector<T,2> zw)` with `1.f` splatted. The slang-rhi#798 fix `float4(barycentrics, 1.f, 1.f)` (via `__init(vector<T,2>, T, T)`) keeps the value and unblocks #12141, whose `static_assert(false)` on `vector<T,4>`'s `(vec2,T)` ctors would make the call E41400 [slang-rhi#798](../learnings/1784281175141-slang-rhi-798-float4-float2-1-f-splat-vs-tail-pad-.md). Design-gated divergence #12093: [[wiki/concepts/slang-language-generics-and-type-system.md]].

## Single-struct SSBO via `GLSLShaderStorageBuffer<T>` (#11028)

For #11028 (open), the hidden `GLSLShaderStorageBuffer<T, L = DefaultDataLayout>` (`hlsl.meta.slang:73-77`) behind the typealias gives `buf.field` with no `[0]`; it compiles on v2026.20 for SPIR-V (std430 `Block`, spirv-val clean), GLSL, HLSL/WGSL (array indexed `[0]`), Metal and CUDA. An explicit `Std430DataLayout` compiles only on SPIR-V/GLSL (others E36107). No read-only variant yet [SSBO](../learnings/1792916435475-non-array-storage-buffer-today-typealias-over-hidd.md).

## Builtin operators: fast path, flag enums, and shifts

Since #11493, `convertToBuiltinArithmeticOp` rewrites `a OP b` on builtin operands to a `BuiltinOperatorExpr` before overload resolution, silently dropping a user `operator*(float4x4,float4x4)` (#11877) [#11877](../learnings/1784156401458-slang-11493-fast-path-user-operator-on-builtin-ope.md). PR #12162 (`pr: breaking change`) adds the declaration-site error, which must reject exactly what the fast path shadows, so reviewers required one `isBuiltinOperationKindEligibleForBaseType(BuiltinOperationKind, BaseType)` beside `getBuiltinOperationKindFromString` replacing the thrice-written ladder (bitwise/shift→int; equality→int|float|bool; logical-not→bool; arithmetic→int|float), explicit cases plus `[[noreturn]]` `SLANG_UNEXPECTED`; test the `this`-receiver branch [#12162](../learnings/1784627727954-slang-when-a-check-must-mirror-the-fast-path-share.md).

**Flag enums.** `|`, `&`, `^` work on `[Flags]` enums because they are generic over `T : ILogical`. Compound forms once came only from `kCompoundBinaryOps` (`__BuiltinLogicalType`); the fix added generic `operator|=/&=/^=` over `T : ILogical` with `[OverloadRank(-10)]` (no ambiguity for builtin integers; named-function lookup, not a desugar) [compound gap](../learnings/1781621242788-slang-flag-enum-compound-assign-gap-ilogical-vs-bu.md). They are on master (`core.meta.slang` ~3913-3930 at ae4e57957; v2026.16 and v2026.21 tags), so the claim in [E39999 shifts](../learnings/1794095435907-slang-and-operators-are-not-generic-over-ilogical-.md) that `&= |= ^=` exist only for `__BuiltinLogicalType` is wrong.

**No generic shifts (#14401).** `ILogical` requires `shl(int)`/`shr(int)`, but `<<`/`>>` exist only in the `kShiftOps` block (~3324-3409) as `__generic<L, R : __BuiltinIntegerType>` intrinsics; no generic `<< >> <<= >>=`. So `first >> second` with `T : ILogical`/`IInteger`, or a shift on an enum, fails E39999 "no overload for '>>'" with note E40022 (v2026.21, ae4e57957). Workaround `x.shr(int(n))`; with `T : IInteger`, `.toUInt()` converts back (`ILogical` has only `init(int)`). The user guide (`docs/user-guide/06-interfaces-generics.md:1405-1412`) is wrong twice: its operator-overload claim fails for shifts, and it says integer matrices implement `ILogical` and `IFloat` includes it, while `IFloat : IArithmetic, IDifferentiable, __IMinMax` (`core.meta.slang:340`) [E39999](../learnings/1794095435907-slang-and-operators-are-not-generic-over-ilogical-.md) [#14401](../learnings/1794098012080-slang-core-module-no-generic-ilogical-shift-operat.md).

**Traps for a shift fix (#14402).** (1) `bool`'s `ILogical` witness costs 1 versus `kConversionCost_BoolToInt` (120), which OverloadRank cannot outweigh, so `b << 2` silently becomes `bool` `true`, not `int` 4. A core `bool` overload breaks AST constant folding (`static const int k = true << 2;`), since `tryConstantFoldExpr` folds only `__intrinsic_op`/implicit-conversion callees, and intrinsic `Lsh` on `bool` is invalid SPIR-V/GLSL/WGSL. Fix: promote a scalar `bool` left operand in `convertToBuiltinArithmeticOp`; explicit `operator<<(b, n)` stays `bool` [bool capture](../learnings/1794103502564-slang-base-clone-build-release-can-be-months-stale.md) [enum:bool](../learnings/1794107028636-slang-shifts-on-bool-tagged-enums-ice-ir-rewrites-.md). (2) Vector `toInt()` returns `this[0]` (~2442), so a `T >> T` built on it shifts every lane by lane 0. (3) Scope rank precedes OverloadRank (`slang-check-overload.cpp` ~2400), so a user-file prototype of a core overload misleads [traps](../learnings/1794098012080-slang-core-module-no-generic-ilogical-shift-operat.md). Probe every operand-type pair (bool/bool too) on a fresh master build [fresh build](../learnings/1794103502564-slang-base-clone-build-release-can-be-months-stale.md).

**`enum : bool` shifts ICE.** `enum Mode : bool` with `m.shr(1)` (or `v.shr(n)` in a `T : ILogical` generic) fails E99997 (`getIntTypeWidth`) on every target (ae4e57957): the synthesized `shl`/`shr` witnesses (`slang-check-decl.cpp` ~9402-9407) are raw `intrinsicOp(Lsh/Rsh)`, so after `lowerEnumType` they shift a `bool`; #14402 routes infix `m >> 1` there too. A `lowerEnumType` fix must also cover `Mode.Off << 1` (`@ConstExpr` typed by the `RateQualified` wrapper, missed by `enumType->firstUse`: walk the module, compare `getDataType()`, keep the rate) and generics, where the body-less `[intrinsicOp(Rsh)]` witness becomes `Rsh` only after specialization (give it a body `IntCast<bool>(Rsh(IntCast<int>(x), n))`) [enum:bool ICE](../learnings/1794107028636-slang-shifts-on-bool-tagged-enums-ice-ir-rewrites-.md).

## `static_assert`, matrix inverse/determinant, fp64 on SPIR-V

**`static_assert` (#13208)** is `__intrinsic_op(kIROp_StaticAssert)`, not a keyword: at module scope `ident(...)` parses as a declarator and fails with `unexpected '(', expected ')'`. #6136 tracks any-scope support (syntax-decl plus module-level `kIROp_StaticAssert`) [static_assert](../learnings/1790019025315-slang-static-assert-is-a-builtin-intrinsic-fn-func.md).

**Inverse/determinant** (master 01dcd3568): the only `inverse(matrix<T,N,N>)` is `glsl.meta.slang:894`, `[require(glsl, GLSL_400)] [require(spirv)]`, no derivative. `determinant` (`hlsl.meta.slang:10513`) is native on HLSL, GLSL, SPIR-V, Metal, WGSL, with a `static_assert(N<=4)` CUDA/CPU fallback and both derivatives. Vectors >4 fail IR validation (E38206), so `matrix<float,12,12>` fails everywhere; no portable inverse (#14020, #14009 / PR #14012) [inverse](../learnings/1793284894132-slang-matrix-inverse-is-glsl-spir-v-only-determina.md).

**fp64 GLSL.std.450 (#14061)** under `SLANG_RUN_SPIRV_VALIDATION=1` (977df1246). **Invalid on `double`, undiagnosed:** sin, cos, tan, asin, acos, atan, atan2, sinh, cosh, tanh, asinh, acosh, atanh, exp, exp10, log, log2, log10, pow, radians, degrees, sincos; vector exp2/ldexp (spirv-val `validate_extensions.cpp:1611-1631`). **Silently narrowed:** scalar exp2/ldexp go through float, as DXC does (hlsl.meta.slang:11362). Rounding, sqrt/rsqrt, abs, sign, saturate, rcp, fmod, min/max/clamp/step/lerp/smoothstep, fma/mad, modf and geometric ops are valid. `[require]` cannot gate on a type argument; use `static_assert(!__isHalf<T>(), "...")` in a `__target_switch` case (hlsl.meta.slang:2347), checked post-specialization by `checkStaticAssert`. No `__isDouble` yet; `T is double` works in user code [fp64](../learnings/1793312363687-slang-spir-v-fp64-math-which-glsl-std-450-ops-are-.md).

## Texture access kinds, gather offsets, and TGSM

**Access kinds (#13536).** Emitters don't reject unknown `kCoreModule_ResourceAccess*` values (GLSL/WGSL fall into sampled `texture`), so a new kind (`RTexture*`) needs a case in each. GLSL `image2D` is `RWTexture2D<float>`, so a `readonly` diagnostic keys on the spelled alias; `readonly` only emits `NonWritable` and stores still compile. `WTexture2DMS` is missing because the alias generator (`hlsl.meta.slang:6130`) compares access to a shape constant [access kinds](../learnings/1791500273983-slang-texture-access-kinds-adding-one-needs-every-.md).

**Gather offsets (#9382).** `Texture2D.Gather(s, uv, int2(2,1))` emits SPIR-V `Offset` + `ImageGatherExtended` instead of `ConstOffset`; GLSL `textureGatherOffset` passes runtime offsets through the same intrinsic, so no wholesale switch [constness](../learnings/1781713033202-slang-9382-gather-constoffset-naive-fix-unsafe-two.md). `-int2(2,1)` folds after spirv-legalize to `int2(-2,-1)` and takes `ConstOffset`, the capability lingering (pre-existing); asserting `Offset`+capability would lock in the bug [negated](../learnings/1781731175811-slang-9382-negated-constant-gather-offset-int2-2-1.md).

**TGSM on DXIL (#10641).** `getExplicitlyDeclaredParamPassingMode` lowered a `groupshared T scratch[N]` parameter `In`: a per-thread `alloca` without `addrspace(3)`, so sharing silently failed [by-value](../learnings/1782228288994-groupshared-array-parameter-lowered-by-value-loses.md). PR #11709 lowers bare `groupshared` params to `BorrowInOut`; the HLSL emitter strips DXC-illegal `groupshared inout` except on mesh `in payload` params. `specializeAddressSpace` on DXIL was falsified as the fix layer [BorrowInOut](../learnings/1782228568362-slang-10641-groupshared-array-param-bug-fix-is-by-.md). GPU-free repro `slangc -target dxil-asm`: zero `addrspace(3)` globals plus `alloca [N x ...]`, a plain groupshared global the positive control [dxil-asm](../learnings/1782216962036-detect-groupshared-tgsm-codegen-bugs-on-dxil-witho.md).

**Variable pointers (SPIR-V, PR #11521).** `requireFunctionTypeCapabilitiesIfNeeded(IRFuncType*)` (from `emitFunc`) declares `VariablePointers` for a `Workgroup`/`StorageBuffer` pointer surviving only in a non-inlined signature; `emitCall` covers the result arm and `emitGetOffsetPtr`/`emitGetElement` cover `StorageBuffer`, so document that rather than add passing tests [variable pointers](../learnings/1780972705906-slang-variable-pointers-signature-walk-fix-only-gr.md).

## Capability atoms on texture methods and E41012

A static `[require]` cannot see a generic `let isCombined`, so a bare-vs-combined-sampler capability uses `__requireTargetExtension(...)` at emit time with a base atom (`texture_sm_4_1`) in `[require]`, as `GetDimensions` does. `Texture.Load`'s unconditional `texture_sm_4_1_samplerless` `[require]` fired spurious E41012 (ProfileImplicitlyUpgraded) on combined samplers under `-profile` [spurious E41012](../learnings/1782889962730-spurious-e41012-profile-upgrade-warning-static-req.md). The AST check fires only on an explicit capability/profile request; IR `LateRequireCapability` covers only `__requireCapability` [source](../learnings/1782895560951-e41012-from-a-require-attribute-comes-from-slang-c.md). It fires for any `[require]`-annotated inlined FuncDecl, so the `[ForceInline]` `texelFetch(...)` wrappers need the same audit as `.Load`/subscript; dropping a stdlib atom can flip generated "DO NOT EDIT" `-restrictive-capability-check` tests red→green, so fix the generator and regenerate [texelFetch](../learnings/1782898835005-fixing-a-capability-require-atom-on-a-texture-meth.md).

**Shadow atoms (#12244).** `GL_EXT_texture_shadow_lod` adds only `sampler2DArrayShadow`/`samplerCubeArrayShadow` bias; other shadow bias `texture`/`textureOffset` is core GLSL 1.50, as is shadow `textureGrad*`. `SampleCmpLevel` is SM6.7, `SampleCmpBias`/`SampleCmpGrad` SM6.8 [bias boundary](../learnings/1785190567550-gl-ext-texture-shadow-lod-bias-form-boundary-expli.md). `texture_shadowlod` is shared (~14 `SampleCmp*` sites, ~57 GLSL overloads), so add `texture_shadow`/`texture_shadowbias` equal to current expansions and re-point only the SampleCmp methods [re-point](../learnings/1785192528373-samplecmp-capability-atom-rename-re-point-not-rena.md).

## Capability system internals, and CPU `half`

`getLatestSpirvAtom()`/`getLatestMetalAtom()` take `elements[elements.getCount() - 2]` because a `_*_latest` alias also holds a stage atom sorting above the versions (max-atom scans grab it). Family predicates (`isSpirvExtensionAtom`) lack `SLANG_API`: test via `.slang`, not `slang-unit-test` [count-2](../learnings/1784424625402-slang-capability-latest-version-atom-helper-must-u.md).

Capability RFC #9210 facts (@33f9ed0ce): `__requireCapability(...)` → `RequireCapabilityStmt`; no generic `IRRequireTargetCapability`; `[require]` (`RequireCapabilityAttribute`) propagates via `_propagateRequirement`, caller ⊇ callee; `CapabilitySet` is a disjunction of conjunctions (`CapabilityTargetSets → CapabilityStageSets → CapabilityAtomSet`); compound capabilities are capdef `alias`es. Park while owners debate (neutral 5-bullet, no fixer dispatch) [RFC #9210](../learnings/1783523347890-slang-capability-rfc-9210-current-system-facts-tha.md).

**CPU/LLVM `half` (#11996).** `SLANG_LLVM` gates out the `_Float16` block in `prelude/slang-cpp-scalar-intrinsics.h`. `(int8_t)half` emits `int8_t(halfValue)`, which fails because explicit operators don't chain (`(int8_t)(float)h` compiles). Approach A adds `explicit` int8-64/double/bool operators via `load()`; native `_Float16` on LLVM is rejected (unsupported on some host triples) [CPU half](../learnings/1783511746989-slang-cpu-half-struct-has-only-operator-float-half.md).

## Supersessions

Falsified: vectors take the abstract-type ctor path (#11730); a negated constant gather offset stays runtime `OpSNegate` (#9382); `specializeAddressSpace` on DXIL fixes groupshared params (#10641).

**Source learnings (39):**
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
- [`<<`/`>>` only for `__BuiltinIntegerType` (E39999/E40022); `x.shr(int(n))` workaround; its compound-op claim is wrong](../learnings/1794095435907-slang-and-operators-are-not-generic-over-ilogical-.md)
- [no generic ILogical shifts (#14401); bool, vector `toInt()` and scope-rank traps; user-guide ILogical errors](../learnings/1794098012080-slang-core-module-no-generic-ilogical-shift-operat.md)
- [`enum : bool` shifts ICE in `lowerEnumType`; `@ConstExpr` rate wrapper and post-specialization witness shapes](../learnings/1794107028636-slang-shifts-on-bool-tagged-enums-ice-ir-rewrites-.md)
- [generic ILogical ops capture `bool` operands; promote in `convertToBuiltinArithmeticOp` (#14402)](../learnings/1794103502564-slang-base-clone-build-release-can-be-months-stale.md)

_Catalog: [[wiki/index.md]]_
