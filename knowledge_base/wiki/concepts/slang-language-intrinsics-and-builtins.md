---
title: "Slang Intrinsics & Builtins"
type: concept
group: slang-language-core
tags: [intrinsics, builtins, spirv, groupshared, texture, gather, variable-pointers, flag-enum, coopvec, vector, capability-atoms, texture-shadow, prefix-expander, min-max, storage-buffer, GLSLShaderStorageBuffer, typealias]
source_count: 34
---

# Slang Intrinsics & Builtins

GPU intrinsics and builtin types are core-module declarations (`core.meta.slang`, `hlsl.meta.slang`, `glsl.meta.slang`); most bugs come from their per-target emit mapping and capability atoms.

## TL;DR

- **`$TR` in `__intrinsic_asm` emits the call's RETURN type; `$T<n>` emits operand n's type, unwrapping a texture to its element type.**
- **`__intrinsic_type`/`__intrinsic_op` are legal in user code** (E31229 covers three other modifiers); a bogus `__intrinsic_op(1000)` ICEs.
- **Emitter rules keyed on `intrinsicDefinition.startsWith(...)` also match user `__intrinsic_asm` text**: arity/type are filters (`return nullptr`), never asserts.
- **A `$N`-remapping marker (`$q`) must also be honored in `shouldFoldInstIntoUseSites`**, or args fold into every use.
- **`float(sign(x))` on SPIR-V is an unfolded `FSign; FToS; SToF` chain**; bare `FSign` changes the sign of zero — the exact rewrite is `FSign(x) + 0.0`.
- **Dot-form `__intrinsic_asm ".Method"` on a `void` method discards a value-returning target op**; capture it (`this = __hlslSplat(t);`).
- **The `$P` prefix expander has no vector case**: generic `min`/`max` on a vector or matrix hits E99997.
- **Overload resolution in a generic body is not redone after specialization**, so a scalar-decomposition fallback costs generic callers the native op; use one target-aware `[ForceInline]` worker.
- **Builtin vector/matrix types ARE `DeclRefType<StructDecl>`**; `createInvokeExprForExplicitCtor` viability must not depend on `outExpr`.
- **`float4(float2 xy, 1.f)` is `(x,y,1,1)` (splat)**; the preserving rewrite is `float4(xy, 1.f, 1.f)`.
- **`|`/`&`/`^` work on `[Flags]` enums (via `ILogical`) but `|=`/`&=`/`^=` do not**; add generic compound ops over `T : ILogical` with `[OverloadRank(-10)]`.
- **The builtin-operator fast path shadows a user operator on builtin operands; the maintainer wants an ERROR**, using a predicate SHARED with the fast path.
- **`static_assert` is a builtin function, function-body only**; at global scope `ident(...)` mis-parses as a declaration.
- **`inverse` is GLSL/SPIR-V only; `determinant` is capped at 4×4 on CUDA/CPU.** N>4 matrices fail IR validation.
- **On SPIR-V most transcendental GLSL.std.450 ops are invalid on `double`, undiagnosed.** Gate with `static_assert` in a `__target_switch` case.
- **A gather offset branches on CONSTNESS** (`ConstOffset` vs `Offset`+`ImageGatherExtended`); a negated constant folds to a constant.
- **A `groupshared T[N]` PARAMETER lowered by-value loses TGSM on DXIL**: fix at parameter lowering (`BorrowInOut`); detect with `-target dxil-asm`.
- **Only the (GroupShared, parameter) arm of the variable-pointers signature walk is fail-without-fix.**
- **An instantiation-dependent capability cannot be a static `[require]`** (generic-dependent `[require]` is unsupported); gate `__requireTargetExtension(...)` at emit time with a base atom in `[require]`.
- **E41012 for a `[require]` comes from the AST check in `slang-check-shader.cpp`, not `LateRequireCapability`**; also audit `glsl.meta.slang` `texelFetch` wrappers.
- **Renaming a shared capability atom is not neutral: ADD a new atom and RE-POINT**; public aliases need `///` docs + doc regen.
- **A family's latest-version atom is `getElements()[count-2]`** (`-1` is the stage atom). Capability predicates lack `SLANG_API`.
- **Single-struct SSBO today: `typealias RWStorageBuffer<T> = GLSLShaderStorageBuffer<T>;`** — omit the layout argument (E36107 off SPIR-V/GLSL).
- **CPU/LLVM `half` is a fallback `struct half` with only `explicit operator float()`**; add explicit conversions, not `_Float16`.
- **A new texture access kind needs a case in EVERY emitter**; GLSL `image2D` IS `RWTexture2D<float>`, so key alias diagnostics on the spelling.

## `__intrinsic_asm` markers and dot-form methods

`$TR` emits the call's return type (`m_callInst->getDataType()`); `$T<n>` emits operand n's type and unwraps an `IRTextureType` to its element type, the usual source of element-vs-vector texture bugs. On #12276 CUDA `Texture2D<float>.Gather` emitted `tex2Dgather<$T0>` = `tex2Dgather<float>` into a promised `float4` (NVRTC error); `tex2Dgather<$TR>` gives `vector<T.Element,4>` (precedent `llvm bitcast`; repro `slangc -target ptx`) [$TR emits the return type](../learnings/1785372605179-intrinsic-asm-tr-marker-emits-the-call-return-type.md).

A dot-prefix `__intrinsic_asm ".Method"` on a `[mutating] void` method emits `receiver.Method(args)` as a bare statement and drops its value. On #12059 HLSL `Matrix::Splat(T)` returns a value, so `CoopMat.fill(t)` left the destination uninitialized (PSO-creation crash). Fix, following `__hlslLoadBAB`: an `internal static This` helper wrapping `$TR::Splat($0)`, used as `this = __hlslSplat(t);` (editing `hlsl.meta.slang` needs the core-module-header regen) [dot-form Splat discards value (#12059)](../learnings/1783725139961-slang-12059-hlsl-coopmat-fill-splat-dot-form-intri.md).

## Intrinsic modifiers in user code, and emitter rules keyed on intrinsic text

E31229 (#12538) rejects only `__magic_type`, `__builtin_type` and `__builtin_requirement` outside the core module; standard modules use `__intrinsic_type`/`__intrinsic_op` without `FromCoreModuleModifier`, so an `isFromCoreModule`-only gate would break them (DeepWiki's "core-only" is wrong). `parseIROp` does not range-check numeric opcodes: `__intrinsic_op(1000)` gives E99997 in Debug, "Unhandled local inst in spirv-emit" in Release. The "never used by an application" sentence lives in shader-slang/spec (`introduction-language-evolution.md:83-84`), so changing it needs a spec PR [intrinsic modifiers legal in user code](../learnings/1792065241922-intrinsic-type-intrinsic-op-are-accepted-in-user-c.md).

So `emitIntrinsicCallExprImpl(inst, intrinsicDefinition, ...)` sees user text too, and a rule keyed on `intrinsicDefinition.startsWith("<builtin>")` matches it. On #13670 a reviewer turned the filter `&& inst->getArgCount() == 1` into `SLANG_RELEASE_ASSERT`; a valid two-arg user `__intrinsic_asm "unpack2x16float(($0) | (($1) << 16u))"` then hit E99997, and a one-arg `int` user intrinsic got wrapped in a `u32`-only WGSL helper Tint rejects. Arity and operand type are preconditions (`if (argCount != 1) return nullptr;` plus e.g. `getDataType()->getOp() == kIROp_UIntType`); exact-string matching narrows but still needs the filter. Pin with a revert-drilled row of same-prefix user intrinsics [prefix rules filter, not assert](../learnings/1792104381131-emitter-rules-keyed-on-an-intrinsic-string-prefix-.md).

`CLikeSourceEmitter::shouldFoldInstIntoUseSites` also reads intrinsic text, counting `$N` uses by raw operand index to decide inlining. A remapping marker like `$q` (skips the split-out sampler at operand 1 of a combined texture-sampler) must be honored there, or a multiply-used argument looks unused and folds into every use: 5 chained combined-sampler `Load`s on Metal/WGSL produced 121 texture reads. #13741 adds one shared `getIntrinsicArgOperandIndex()` (slang-intrinsic-expand.cpp) for both readers [$q in the fold heuristic](../learnings/1792284128530-q-intrinsic-strings-must-also-be-understood-by-the.md).

## `sign()` round-trip on SPIR-V (#13676)

HLSL `sign()` returns `int`, so float `sign` lowers to one opaque `spirv_asm { FSign; OpConvertFToS }`, and `float(sign(x))` adds `OpConvertSToF` that neither Slang IR nor spirv-opt folds. The round-trip yields only {-1, +0, +1}; bare `FSign` returns -0.0 for -0.0 and ±1/±0 for NaN, so folding to it changes the sign of zero (fast-math-only, #12405). The exact rewrite `FSign(x) + 0.0` is dropped by spirv-opt at -O1+ unless `NoContraction` (precise) or float-controls apply; `FSign` never returns NaN, so `OpConvertFToS` is always defined. DXC gives 0 for NaN and -0; cpp/cuda `F32_sign` gives 1 for NaN. For an IR peephole to see the casts, split a `[__readNone]` FSign-only asm helper plus `__float_to_int_cast`, ForceInline the wrapper, and recognize the helper via `KnownBuiltinDeclName` + `getBuiltinFuncEnum`. GLSL mode has no float `sign`, so GLSL `sign(x)/2` becomes integer `OpSDiv` (a bug) [sign() round-trip (#13676)](../learnings/1792095513009-float-int-fsign-x-fsign-x-0-0-exactly-spirv-opt-fo.md).

## The `$P` prefix expander and generic vector/matrix `min`/`max` (#11075, PR #12249)

A generic `T:IFloat`/`IComparable` `min`/`max` specialized on a vector ICEs (E99997) on `-target cpp`/`cuda` (regression from #9593): concrete overloads decompose via `VECTOR_MAP_BINARY`, but the generic path emits one whole-vector `$P_min`, and `case 'P'` in `slang-intrinsic-expand.cpp` has no vector case. A meta.slang-only fix fails; the authorized fix unwraps `IRVectorType` before the switch, adds vector-arity prelude helpers (CPU `template<int N>`, CUDA explicit 2/3/4), and folds the `kIROp_IsVector` peephole on the pre-unwrap type. Gotchas: `slang-embed` follows `#include` (prelude edits need a fresh worktree); include order forces a `Vector<T,N>` forward-decl; a draft-PR `gh workflow run ci.yml` shows a benign priority-yield "failure" [$P vector min/max fix layer](../learnings/1785207760204-slang-p-prefix-vector-min-max-fix-layer-prelude-em.md). The matrix sibling (`$P_max` on a matrix falls to `default:`) is pre-existing and outside vector scope, so blocking on it is a scope call [matrix sibling crash](../learnings/1785210150352-slang-p-vector-min-max-fix-leaves-matrix-sibling-c.md). The round-2 `E55215` in `default:` catches only element types with no prefix; prefixed types lacking a vector helper (`intptr_t`→IPTR, `int16_t`→I16 via `vector<intptr_t,N>:IInteger`) slip to "undeclared identifier"; verdict APPROVE_WITH_NITS [E55215 misses prefixed types](../learnings/1785214611295-slang-12249-round-2-e55215-diagnostic-misses-prefi.md).

**A scalar-decomposition fallback overload costs generic callers the native aggregate op.** A low-rank broad `min<T:__BuiltinArithmeticType, let N:int>(vector<T,N>, vector<T,N>)` with a `VECTOR_MAP_BINARY` body is fine for concrete callers (the narrow overload wins on rank), but generic bodies aren't re-resolved after specialization, so every generic caller gets per-element scalar ops (no SPIR-V `FMin`/`SMin`, no HLSL `min`). The maintainer's #13139 (closing #13114) routes the int, float and broad families through shared target-aware `[ForceInline]` workers (`__vectorMinImpl`, `__matrixMinImpl`), so all get native ops and matrices keep `MatrixLayoutMode`; cover matrices as well as vectors [broad overload loses native ops](../learnings/1790642295187-slang-core-module-a-broad-generic-overload-that-de.md).

## Builtin vector types and constructor resolution

Builtin vector/matrix types are `DeclRefType<StructDecl>`, so init-list coercion goes through `createInvokeExprForExplicitCtor` (the struct branch of `_coerceInitializerList`), not `createCtorInvokeExprForAbstractType`. On #11730 its viability `return true` was nested under `if (outExpr)`; the `canCoerce` probe passes null, so `{float2, float}` failed as an argument but worked in a declaration; the fix reports viability independently of `outExpr` [builtin vector is DeclRefType<StructDecl> (#11730)](../learnings/1782733705823-slang-11730-builtin-vector-is-a-declreftype-lt-str.md).

`float4(float2 barycentrics, 1.f)` splats `1.f` to `float2(1,1)` and resolves `__init(vector<T,2> xy, vector<T,2> zw)` → `(x,y,1,1)`, not a tail-pad. The slang-rhi#798 fix `float4(barycentrics, 1.f, 1.f)` resolves `__init(vector<T,2> xy, T z, T w)` to the same value, keeping the ray-tracing test unchanged, and unblocks #12141, whose `static_assert(false)` on the `(vec2,T)` ctors for `vector<T,4>` would otherwise make the call E41400 [float4(float2,1.f) splat (slang-rhi#798)](../learnings/1784281175141-slang-rhi-798-float4-float2-1-f-splat-vs-tail-pad-.md). The same design-gated divergence is #12093; see [[wiki/concepts/slang-language-generics-and-type-system.md]].

## A single-struct SSBO today: `typealias` over the hidden `GLSLShaderStorageBuffer<T>` (#11028)

#11028 (open, jkwak-work) asks for `RWStorageBuffer<T>`/`StorageBuffer<T>` as a single-struct SSBO. The hidden core type `GLSLShaderStorageBuffer<T, L = DefaultDataLayout>` (`hlsl.meta.slang:73-77`, `//@hidden`) with `typealias RWStorageBuffer<T> = GLSLShaderStorageBuffer<T>;` lets user code write `buf.field` with no `[0]`. Compile-only on v2026.20: SPIR-V gets a StorageBuffer `Block` with std430 offsets and no runtime array (spirv-val clean); GLSL a `layout(std430) buffer` block; HLSL a `RWStructuredBuffer<T>` indexed `[0]`; WGSL a storage `array<T>` indexed `[0]`; Metal a `device*`; CUDA compiles. With an explicit `Std430DataLayout` only SPIR-V/GLSL compile (others E36107), so omit it. No read-only variant; #11028 plans to rename to `RWStorageBuffer<T,L>` and add `StorageBuffer<T,L>` [SSBO via GLSLShaderStorageBuffer typealias](../learnings/1792916435475-non-array-storage-buffer-today-typealias-over-hidd.md).

## Builtin operators: fast path, shared predicates, and flag enums

Since #11493, `convertToBuiltinArithmeticOp` (`slang-check-expr.cpp`) rewrites `a OP b` on builtin scalar/vector/matrix operands to a `BuiltinOperatorExpr` before overload resolution, silently dropping a user `operator*(float4x4,float4x4)` (#11877); the maintainer wants that declaration to be an error [fast path: maintainer wants ERROR](../learnings/1784156401458-slang-11493-fast-path-user-operator-on-builtin-ope.md). PR #12162 (`pr: breaking change`) adds the declaration-site diagnostic, which must reject exactly what the fast path shadows. Reviewers gated it on collapsing the per-operator element-eligibility ladder (bitwise/shift→int; equality→int|float|bool; logical-not→bool; arithmetic→int|float), written three times, into one `isBuiltinOperationKindEligibleForBaseType(BuiltinOperationKind, BaseType)` beside `getBuiltinOperationKindFromString`. A "// matches X" comment signals extraction; use explicit cases plus `[[noreturn]]` `SLANG_UNEXPECTED`, not a plausible `default:`; test the `this`-receiver branch most [share the fast-path predicate](../learnings/1784627727954-slang-when-a-check-must-mirror-the-fast-path-share.md).

Binary `|`, `&`, `^` work on `[Flags]` enums because they are generic over `T : ILogical`, which enums conform to; the compound forms come from `kCompoundBinaryOps`, constrained on `__BuiltinLogicalType`, which enums do not. The fix adds generic `operator|=/&=/^=` over `T : ILogical` in `core.meta.slang` with `[OverloadRank(-10)]` to avoid ambiguity for builtin integers; `a |= b` resolves by named-function overload lookup, not a checker desugar [flag-enum compound-assign gap](../learnings/1781621242788-slang-flag-enum-compound-assign-gap-ilogical-vs-bu.md).

## `static_assert` is function-body only (#13208)

`static_assert(cond, msg)` is a builtin intrinsic function (`__intrinsic_op(kIROp_StaticAssert)`), not a keyword, so it is valid only as an expression-statement in a function body. At module scope (`parseDecls`→`ParseDeclWithModifiers`) it is consumed as a type name, `(` commits to a function declarator, and the arguments fail with a misleading `unexpected '(', expected ')'`; with no decl→expr backtrack at module scope, any global `ident(...)` mis-parses (a cue for a tailored diagnostic). Any-scope support is #6136 (a syntax-decl plus module-level `kIROp_StaticAssert`; the emit-time checker already recurses the module) [static_assert is function-body only](../learnings/1790019025315-slang-static-assert-is-a-builtin-intrinsic-fn-func.md).

## Matrix inverse and determinant: which targets have them

On master 01dcd3568 (2026-10-29) the only `inverse(matrix<T,N,N>)` is `glsl.meta.slang:894`, gated `[require(glsl, GLSL_400)] [require(spirv)]` (GLSL `inverse`, GLSL.std.450 MatrixInverse) — no HLSL/CUDA/Metal/CPU/WGSL path, no derivative. `determinant` (`hlsl.meta.slang:10513`) is native on HLSL, GLSL, SPIR-V, Metal and WGSL; the CUDA/CPU fallback has `static_assert(N<=4)`; it has forward and backward derivatives (`diff.meta.slang:2829/2835`). Vectors >4 are rejected at IR validation (`slang-ir-validate.cpp:700-716`, E38206), so `matrix<float,12,12>` fails everywhere. Slang has no portable matrix inverse (relevant to #14020, #14009 / PR #14012) [inverse/determinant targets](../learnings/1793284894132-slang-matrix-inverse-is-glsl-spir-v-only-determina.md).

## fp64 math on SPIR-V: GLSL.std.450 ops that reject `double` (#14061)

Measured on ToT 977df1246, each function alone under `SLANG_RUN_SPIRV_VALIDATION=1`. **Invalid on `double`, no slangc diagnostic:** sin, cos, tan, asin, acos, atan, atan2, sinh, cosh, tanh, asinh, acosh, atanh, exp, exp10, log, log2, log10, pow, radians, degrees, sincos; exp2 and ldexp on vectors (spirv-val's 16/32-bit-only list: `validate_extensions.cpp:1611-1631`). **Silently narrowed:** scalar exp2 and ldexp go to float and back — valid but lossy (hlsl.meta.slang:11362); DXC narrows the same way. **Valid:** sqrt, rsqrt, floor, ceil, round, trunc, frac, abs, sign, saturate, rcp, fmod, min, max, step, clamp, lerp, smoothstep, fma, mad, modf, length, distance, normalize, cross, reflect, refract, faceforward. `[require]` cannot gate on a generic type argument (capabilities are per declaration; `double` has no `[require]`); the working pattern is `static_assert(!__isHalf<T>(), "...")` inside a `__target_switch` case (hlsl.meta.slang:2347), checked after specialization by `checkStaticAssert` (slang-emit.cpp:695). No `__isDouble` helper yet, but `T is double` works in user code [SPIR-V fp64 math ops](../learnings/1793312363687-slang-spir-v-fp64-math-which-glsl-std-450-ops-are-.md).

## Texture access kinds: every emitter, and aliases that share a type (#13536)

Texture access is `kCoreModule_ResourceAccess*` 0-4, and emitters don't reject unhandled values: GLSL and WGSL fall into sampled `texture`, and the SPIR-V `Sampled` switch has no default (its `SLANG_ASSERT` is `SLANG_ASSUME` in Release). A new kind (#13536's `RTexture*`) needs an explicit case in each. GLSL `image2D` is the same type as `RWTexture2D<float>` (`_Texture`, access 1), so a `readonly RWTexture*` diagnostic must key on the spelled alias; `readonly` on `RWTexture2D` only emits `NonWritable` and stores still compile. `WTexture2DMS` is missing because the alias generator (`hlsl.meta.slang:6130`) compares access to a shape constant [texture access kinds need every emitter](../learnings/1791500273983-slang-texture-access-kinds-adding-one-needs-every-.md).

## Texture gather: `ConstOffset` vs `Offset` (#9382)

`Texture2D.Gather(s, uv, int2(2,1))` emits SPIR-V `Offset` plus `ImageGatherExtended` instead of `ConstOffset`; switching wholesale is unsafe because GLSL `textureGatherOffset` can pass a runtime offset through the same intrinsic, so branch on constness (two stale draft PRs exist) [Gather ConstOffset: naive fix unsafe](../learnings/1781713033202-slang-9382-gather-constoffset-naive-fix-unsafe-two.md). A negated constant (`-int2(2,1)`) is `Neg(MakeVector(...))` at spirv-legalize but later folds to `int2(-2,-1)` and takes `ConstOffset`, with the capability lingering (pre-existing); asserting `Offset`+capability for it would lock in the bug [negated constant offset folds (#9382)](../learnings/1781731175811-slang-9382-negated-constant-gather-offset-int2-2-1.md).

## GroupShared / TGSM on DXIL (#10641)

A `groupshared T scratch[N]` parameter, unlike a global, was lowered by-value (`In`) in `getExplicitlyDeclaredParamPassingMode`, giving a per-thread `alloca` without `addrspace(3)` on DXIL, so sharing silently failed; SPIR-V keeps a `Workgroup` pointer [groupshared param loses TGSM](../learnings/1782228288994-groupshared-array-parameter-lowered-by-value-loses.md). PR #11709 lowers bare `groupshared` params (`HLSLGroupSharedModifier`, no `InModifier`) to `BorrowInOut`; the HLSL emitter strips the DXC-illegal `groupshared inout` except for mesh payload params (`IRGroupSharedRate` but need `in payload`). Extending `specializeAddressSpace` to DXIL was falsified as the fix layer [fix is by-reference lowering](../learnings/1782228568362-slang-10641-groupshared-array-param-bug-fix-is-by-.md). GPU-free repro: `slangc -target dxil-asm` — zero `addrspace(3)` globals plus `alloca [N x ...]` proves the bug, with a plain groupshared global as positive control [detect TGSM bugs via dxil-asm](../learnings/1782216962036-detect-groupshared-tgsm-codegen-bugs-on-dxil-witho.md).

## Variable pointers (SPIR-V, PR #11521)

`requireFunctionTypeCapabilitiesIfNeeded(IRFuncType*)`, called from `emitFunc`, sends result and parameter types to `requireVariableBufferCapabilityIfNeeded`, declaring `SPV_KHR_variable_pointers`/`VariablePointers` for a `Workgroup`/`StorageBuffer` pointer surviving only in a non-inlined signature. Only (GroupShared, parameter) fails without the fix — the result-type arm is covered by `emitCall` and `StorageBuffer` by `emitGetOffsetPtr`/`emitGetElement` — so document that rather than add passing tests [only (GroupShared, parameter) fails](../learnings/1780972705906-slang-variable-pointers-signature-walk-fix-only-gr.md).

## Capability atoms on texture methods and E41012

An instantiation-dependent capability (bare vs. combined sampler) cannot be a static `[require]`, which cannot reference a generic `let isCombined`: gate `__requireTargetExtension(...)` on the generic at emit time and keep a non-extension base atom (`texture_sm_4_1`) in `[require]`, as `GetDimensions` does. `Texture.Load`'s unconditional `[require(..., texture_sm_4_1_samplerless)]` disagreed with its gated `if(isCombined==0)` GLSL emission, firing spurious `warning E41012 (ProfileImplicitlyUpgraded)` on combined samplers under `-profile` [spurious E41012: static [require] vs isCombined](../learnings/1782889962730-spurious-e41012-profile-upgrade-warning-static-req.md). The warning comes from the AST check in `slang-check-shader.cpp` (gated on an explicit capability/profile request), not IR `LateRequireCapability` (only the `__requireCapability` statement), and the AST path cannot see generic lets [E41012 comes from slang-check-shader.cpp](../learnings/1782895560951-e41012-from-a-require-attribute-comes-from-slang-c.md). It fires for any `[require]`-annotated inlined FuncDecl, so editing only `.Load`/subscript in `hlsl.meta.slang` is incomplete: the `[ForceInline]` `texelFetch(...)` wrappers in `glsl.meta.slang` carry their own samplerless `[require]` (several hardcoded-combined) — `grep texture_sm_4_1_samplerless source/slang/glsl.meta.slang` and decide each. Dropping a stdlib atom can flip generated "DO NOT EDIT" `-restrictive-capability-check` negative tests red→green; fix the generator and regenerate [also check glsl.meta.slang texelFetch wrappers](../learnings/1782898835005-fixing-a-capability-require-atom-on-a-texture-meth.md).

## Shadow-texture capability atoms (#12244)

The `GL_EXT_texture_shadow_lod` bias boundary is narrower than its explicit-LOD boundary, so don't reuse the `texture_shadowlod_ext` LOD shape list for bias: bias `texture`/`textureOffset` is core GLSL 1.50 for `sampler1D/1DArray/2DShadow` and `samplerCubeShadow`; the extension adds only `sampler2DArrayShadow`/`samplerCubeArrayShadow` bias; `textureGrad*` on shadow samplers is core. `SampleCmpLevel` is SM6.7, `SampleCmpBias`/`SampleCmpGrad` SM6.8 [shadow_lod bias ≠ LOD boundary](../learnings/1785190567550-gl-ext-texture-shadow-lod-bias-form-boundary-expli.md). Renaming `texture_shadowlod`→`texture_shadow` is wrong because the atom is shared (~14 `SampleCmp*` sites plus ~57 GLSL `textureLod`/`texture` overloads): add `texture_shadow`/`texture_shadowbias` equal to the current expansions and re-point only the SampleCmp methods; a new public alias needs `///` docs and a doc regen [SampleCmp atom: re-point, not rename](../learnings/1785192528373-samplecmp-capability-atom-rename-re-point-not-rena.md).

## Capability system internals

To derive a family's latest version atom from a `_*_latest` alias, mirror `getLatestSpirvAtom()`/`getLatestMetalAtom()`: `elements[elements.getCount() - 2]`, because a version alias's `CapabilitySet` includes a stage atom sorting above all version atoms (max-atom scans grab it; gap-walks segfault). `isSpirvExtensionAtom` and the family predicates lack `SLANG_API`, so a `slang-unit-test` caller fails to link; test via `.slang` [latest-version atom = count-2](../learnings/1784424625402-slang-capability-latest-version-atom-helper-must-u.md).

Facts for capability RFC triage (#9210, @33f9ed0ce): `__requireCapability(...)` → `RequireCapabilityStmt` exists; no generic `IRRequireTargetCapability` op (only GLSL/WGSL-extension decorations plus `LateRequireCapability`); `[require]` is `RequireCapabilityAttribute`, propagated by `_propagateRequirement` with the caller-⊇-callee check `CapabilitySet::checkCapabilityRequirement`; `CapabilitySet` is a disjunction of conjunctions (`CapabilityTargetSets → CapabilityStageSets → CapabilityAtomSet`); compound capabilities exist as `alias` in `slang-capabilities.capdef`. Defects #11631 and #11903 corroborate the RFC; generic-parameter-dependent `[require]` is unsupported. While owners debate, park it (neutral 5-bullet, both directions, no fixer dispatch) [capability RFC #9210 facts](../learnings/1783523347890-slang-capability-rfc-9210-current-system-facts-tha.md).

## CPU/LLVM `half`: no half→integer conversion (#11996)

`SLANG_LLVM` gates out the native `_Float16` block in `prelude/slang-cpp-scalar-intrinsics.h`, so CPU/LLVM `half` is the fallback `struct half` with only `explicit operator float()`. `(int8_t)half` lowers to one `kIROp_CastFloatToInt` emitted as `int8_t(halfValue)`, which fails because an explicit `operator float()` doesn't chain through one cast (`(int8_t)(float)h` compiles). Approach A adds `explicit` operators (int8-64 signed/unsigned, double, bool) via `load()`; native `_Float16` on LLVM is rejected (unsupported on some host triples) [CPU half has only operator float (#11996)](../learnings/1783511746989-slang-cpu-half-struct-has-only-operator-float-half.md).

## Supersessions

Falsified: vectors take the abstract-type ctor path (#11730); a negated constant gather offset stays runtime `OpSNegate` (#9382); `specializeAddressSpace` on DXIL fixes groupshared params (#10641).

**Source learnings (34):**
- [`__intrinsic_type`/`__intrinsic_op` legal in user code; E31229 covers three modifiers; bogus opcode → E99997](../learnings/1792065241922-intrinsic-type-intrinsic-op-are-accepted-in-user-c.md)
- [intrinsic-prefix emitter rules filter arity/type, never assert; revert-drilled row](../learnings/1792104381131-emitter-rules-keyed-on-an-intrinsic-string-prefix-.md)
- [`float(sign(x))` == `FSign(x)+0.0`; signed-zero hazard; peephole needs the cast outside asm (#13676)](../learnings/1792095513009-float-int-fsign-x-fsign-x-0-0-exactly-spirv-opt-fo.md)
- [`static_assert` function-body only; any-scope is #6136 (#13208)](../learnings/1790019025315-slang-static-assert-is-a-builtin-intrinsic-fn-func.md)
- [latest-version atom = `count-2`; no `SLANG_API`](../learnings/1784424625402-slang-capability-latest-version-atom-helper-must-u.md)
- [`float4(float2,1.f)` splats to (x,y,1,1) (slang-rhi#798)](../learnings/1784281175141-slang-rhi-798-float4-float2-1-f-splat-vs-tail-pad-.md)
- [only (GroupShared, parameter) is fail-without-fix (#11521)](../learnings/1780972705906-slang-variable-pointers-signature-walk-fix-only-gr.md)
- [flag-enum compound assign: `ILogical` vs `__BuiltinLogicalType`](../learnings/1781621242788-slang-flag-enum-compound-assign-gap-ilogical-vs-bu.md)
- [Gather ConstOffset: branch on constness (#9382)](../learnings/1781713033202-slang-9382-gather-constoffset-naive-fix-unsafe-two.md)
- [negated constant offset folds to ConstOffset (#9382)](../learnings/1781731175811-slang-9382-negated-constant-gather-offset-int2-2-1.md)
- [GPU-free TGSM detection via `dxil-asm`](../learnings/1782216962036-detect-groupshared-tgsm-codegen-bugs-on-dxil-witho.md)
- [groupshared param lowered by-value loses TGSM (#10641)](../learnings/1782228288994-groupshared-array-parameter-lowered-by-value-loses.md)
- [fix is `BorrowInOut` lowering; address-space recovery falsified](../learnings/1782228568362-slang-10641-groupshared-array-param-bug-fix-is-by-.md)
- [builtin vector is `DeclRefType<StructDecl>`; `if(outExpr)` guard bug (#11730)](../learnings/1782733705823-slang-11730-builtin-vector-is-a-declreftype-lt-str.md)
- [spurious E41012: static samplerless `[require]` vs `isCombined` gate](../learnings/1782889962730-spurious-e41012-profile-upgrade-warning-static-req.md)
- [E41012 from slang-check-shader.cpp, not `LateRequireCapability`](../learnings/1782895560951-e41012-from-a-require-attribute-comes-from-slang-c.md)
- [also fix glsl.meta.slang `texelFetch` wrappers](../learnings/1782898835005-fixing-a-capability-require-atom-on-a-texture-meth.md)
- [capability RFC #9210 system facts; park under owner debate](../learnings/1783523347890-slang-capability-rfc-9210-current-system-facts-tha.md)
- [CPU `half` has only `operator float` (#11996)](../learnings/1783511746989-slang-cpu-half-struct-has-only-operator-float-half.md)
- [dot-form `Splat` discards value; capture with `this = ...` (#12059)](../learnings/1783725139961-slang-12059-hlsl-coopmat-fill-splat-dot-form-intri.md)
- [fast path shadows user operator; maintainer wants ERROR (#11877)](../learnings/1784156401458-slang-11493-fast-path-user-operator-on-builtin-ope.md)
- [share `isBuiltinOperationKindEligibleForBaseType` (#12162)](../learnings/1784627727954-slang-when-a-check-must-mirror-the-fast-path-share.md)
- [shadow_lod bias boundary ≠ LOD boundary](../learnings/1785190567550-gl-ext-texture-shadow-lod-bias-form-boundary-expli.md)
- [SampleCmp atom: add and re-point, not rename (#12244)](../learnings/1785192528373-samplecmp-capability-atom-rename-re-point-not-rena.md)
- [`$P` vector min/max fix layer; prelude embedding (#11075/#12249)](../learnings/1785207760204-slang-p-prefix-vector-min-max-fix-layer-prelude-em.md)
- [matrix sibling crash, out of vector scope (#12249)](../learnings/1785210150352-slang-p-vector-min-max-fix-leaves-matrix-sibling-c.md)
- [E55215 misses prefixed element types (#12249)](../learnings/1785214611295-slang-12249-round-2-e55215-diagnostic-misses-prefi.md)
- [`$TR` emits the call return type (#12276)](../learnings/1785372605179-intrinsic-asm-tr-marker-emits-the-call-return-type.md)
- [broad scalar-decomposition overload loses native ops; shared worker (#13139)](../learnings/1790642295187-slang-core-module-a-broad-generic-overload-that-de.md)
- [new access kind needs every emitter; image2D == RWTexture2D (#13536)](../learnings/1791500273983-slang-texture-access-kinds-adding-one-needs-every-.md)
- [`$q` in `shouldFoldInstIntoUseSites`; shared `getIntrinsicArgOperandIndex()` (#13741)](../learnings/1792284128530-q-intrinsic-strings-must-also-be-understood-by-the.md)
- [SSBO via `GLSLShaderStorageBuffer<T>` typealias; omit layout (#11028)](../learnings/1792916435475-non-array-storage-buffer-today-typealias-over-hidd.md)
- [`inverse` GLSL/SPIR-V only; `determinant` CUDA/CPU 4×4 cap (#14020, #14009)](../learnings/1793284894132-slang-matrix-inverse-is-glsl-spir-v-only-determina.md)
- [fp64 GLSL.std.450 invalid/narrowed ops; `static_assert` in `__target_switch` (#14061)](../learnings/1793312363687-slang-spir-v-fp64-math-which-glsl-std-450-ops-are-.md)

_Catalog: [[wiki/index.md]]_
