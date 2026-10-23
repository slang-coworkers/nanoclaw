---
title: Slang Compiler Crash & Legalization Probes — Front-End Fall-Throughs, Type Legalization, and Linker Traps
type: concept
group: slang-grab-bag
tags: [slang, ir-lowering, codegen, legalization, glsl-legalize, cuda, spirv, byte-address-buffer, producer-fix]
source_count: 24
---

# Slang Compiler Crash & Legalization Probes

## TL;DR

Verified root-cause traces for a cluster of Slang compiler crashes/miscompiles, all resolved at the producer/IR layer rather than by masking in emit. Common shape: an early classifier or lowering pass mishandles an input shape, and the crash surfaces far downstream in codegen or the linker.

- **`if(decoration){ if(sv_){...} }` with the real work in the sibling `else` silently drops the middle case**: the tess patch-constant Location-0 collision is a fall-through, NOT a shared-counter race; add `kIROp_PatchDecoration` so per-patch vars get a separate location set. Verify by IR dump.
- **A zero-size/void struct field has no byte-address skip**, so `.Load<void>` is emitted and DXIL/SPIRV/GLSL fail. Add a natural-size-0 skip in the `emitLegalLoad`/`emitLegalStore` field loops, mirroring buffer-element-type lowering.
- **`getDefaultVal` on an `AssocTypeDecl` built a zero-operand `IRMakeStruct`** over an opaque type (positional OOB after type-flow specialization). Fix producer-side with `emitDefaultConstruct`; assert the consumer with EXACT `==`.
- **Array + ConstantBuffer + resource element** crashes type-legalization: `legalizeGetElement` (value path) has no `implicitDeref` case. The trigger is the resource, not "zero-size."
- **A non-null `IRPtrLit` reaching the linker** is a `HighLevelDecl` decoration on a late-synthesized inst that escaped `stripFrontEndOnlyInstructions` (front-end lowering only). Fix the producer; don't relax the linker assert.
- **`IREntryPointDecoration` relocation** has two seductive-but-wrong companion fixes; `SLANG_ASSERT(x); if(!x)…` is DEAD in Release (`__builtin_assume` deletes the null-check).
- **CUDA surface-stride-through-a-param** is a documented structural limitation (`_findImageFormat` can't see `[format]` through an `IRParam`), NOT a regression.
- **A partial-init struct's spurious varying store is `fieldExtract(load(var))`, not `IRUndefined`**; handle both shapes in glsl-legalize's `assign`.
- **Nested swizzle-of-swizzle vector lvalue** miscompiles from `.add(count)` (should be `.setCount`) plus a by-value lambda output param (should be `auto&`).
- **A full-coverage texture swizzle store (`t[i].xyzw = v`) is lowered as read-modify-write**: fix in `legalizeStore`, measuring coverage against the image op's texel (4-wide on Metal/GLSL/SPIR-V, `T` on CUDA). Plain `t[i] = v` lowers through the `set` accessor, so test both spellings.
- **Inherited-field access through a BoundMember/BoundStorage base (#13348) needs `InheritanceDecl` at all three `BoundMemberInfo` consumers**, not just `materialize`.
- **An entry point with a `uniform` param, called by another compiled entry point, segfaults on every target** (open on master). Before `fixEntryPointCallsites` only the borrow pass updates callers; the uniform-param hoist and `translateGlobalVaryingVar` change arity silently.
- **`CoerceToProperTypeImpl` has THREE failure representations, not two**: normalize at the wrapper.
- **"guard A subsumes guard B" is a claim about the FULL consumer set of each**: a `static_assert` reachability walk and `isFromCoreModule` cover disjoint consumers; keep both.
- **Before turning a fallback into a `SLANG_RELEASE_ASSERT` on a closed set of IR layout shapes, list the `IRTypeLayout` subclasses and probe each** (existential via `slangc -specialize`, pointer, combined-sampler, DescriptorHandle). Run the full suite after adding the assert.
- **Zero hits in a coverage drill (log each guard to a file, run the full suite) shows the suite does not reach a branch, not that no input does.** It justifies deleting dead guards, not asserting: on #13872 an emitter fallback made a release assert on 0 hits ICEd dynamic-dispatch generics at `-g2`. Audit the producer class first, or keep a graceful fallback plus a `-validate-ir` rule.
- **On HLSL/CPU/CUDA a spec-const `[numthreads]` operand is a removed inst with a null type**; any pass that reads its type before emit segfaults.

## Front-end / classifier fall-throughs that crash downstream

Two atoms trace the tess patch-constant Location-0 collision to a classifier fall-through, correcting
an earlier "shared counter race" framing. In `createPatchConstantFuncResultTypeLayout`
(`slang-ir-glsl-legalize.cpp:1181-1199`), a field with any `IRSemanticDecoration` enters the outer
`if`; only `sv_`-prefixed names do work there, and the `getLSBZero()` VaryingOutput allocator lives
in the sibling `else` (no-semantic fields only). A *user* semantic like `PATCH_LINE` satisfies the
outer condition, fails the inner `sv_` test, reaches neither branch, gets no offset, and defaults to
Location 0 — colliding with per-control-point output. The collision never touches the shared
`usedBindingIndex` counter, so adding `kIROp_PatchDecoration` (→ `SpvDecorationPatch`) alone clears
the standalone-validation failure because Patch-decorated vars occupy a separate location set — no
counter change needed ([tess patch-constant is a 3-way classification gap, not a shared counter
race](../learnings/1787640266798-slang-tess-patch-constant-user-output-location-bug.md),
[CORRECTION: user patch-constant field misses Location via a
fall-through](../learnings/1787641994236-correction-user-patch-constant-field-misses-locati.md)).
The transferable tell: an `if(decoration){ if(sv_){} }` with no inner `else` silently drops the
value that satisfies the outer but not the inner condition — check for it before blaming a shared
allocator, and disambiguate with `-dump-ir`.

The `getDefaultVal(Type*)` bug is the producer for a latent positional-OOB (#12132). `AssocTypeDecl`
derives from `AggTypeDecl`, so `T.Assoc x = {}` fell into the `AggTypeDecl` branch and built a
zero-operand `IRMakeStruct` over the opaque associated type; after type-flow specialization resolves
it to a real struct, `analyzeMakeStruct` reads `getOperand(i)` positionally → OOB. Fix producer-side
with an `AssocTypeDecl` branch calling `emitDefaultConstruct` (mirroring the sibling `InterfaceDecl`
case), and assert the consumer with EXACT `==`, not `min()` (a min-bound masks a future
under-supplying producer — the "silent impossible-shape" red flag) ([getDefaultVal on AssocTypeDecl
built an empty IRMakeStruct](../learnings/1787585281811-slang-getdefaultval-on-assoctypedecl-built-an-empt.md)).

`ParseModifiers` on a name-first decl position is source-breaking. On slang#12551 (attributes on enum
members) `ParseModifiers` accepts bareword modifier keywords, so `enum FilterMode { point, linear }`
— valid for years — started erroring because `point`/`linear` were eaten as modifiers. Collect ONLY
bracketed `[...]` attributes via `ParseSquareBracketAttributes` in any position whose identifier can
be a bareword modifier; this also closes the silent-accept gap where `isModifierAllowedOnDecl` has no
policy for the new decl kind ([ParseModifiers on a decl whose name can be a bareword keyword breaks
previously-valid code](../learnings/1787558855449-parsemodifiers-on-a-decl-whose-name-can-be-a-barew.md)).

## Type legalization, linking, and Release-guard traps

An empty/zero-size struct field crashes byte-address lowering: `ByteAddressBuffer.Load<Item>` where
`Item { float a; Empty b; }` emits `.Load<void>` for the empty field (DXIL "external function",
SPIRV divide-by-zero from stride 0). The byte-address pass has no skip for zero-sized fields; add one
in the `emitLegalLoad`/`emitLegalStore` field loops (query `getNaturalSizeAndAlignment`), mirroring
the void-field skip already used in buffer-element-type lowering ([ByteAddressBuffer.Load of struct
with empty/zero-size field emits Load<void>](../learnings/1787580105549-byteaddressbuffer-load-of-struct-with-empty-zero-s.md)).
Separately, `ConstantBuffer<Foo> arr[N]` where `Foo` contains a resource crashes type-legalization on
all targets — the resource makes `Foo` legalize to a non-simple `LegalType`, array-wrapping
distributes it, and `legalizeGetElement` (the value path) handles none/simple/pair/tuple but has no
`implicitDeref` case (unlike `legalizeGetElementPtr`). The common factor is the resource, not a
zero-size ordinary part — the MIXED bytes+resource case crashes too ([array of ConstantBuffer with
resource element crashes type-legalization](../learnings/1787601573078-array-of-constantbuffer-with-resource-element-cras.md)).

A non-null `IRPtrLit` surviving to the linker asserts because a raw front-end `Decl*` is meaningless
in a fresh target module. Its only common producer is `addHighLevelDeclDecoration`, and that
decoration is stripped by `stripFrontEndOnlyInstructions` — which runs ONLY during front-end module
IR generation, NOT inside `linkAndOptimizeIR`. So anything created AFTER front-end lowering (a
late-synthesized entry point) that attaches a HighLevelDecl decoration survives to trip the assert.
Fix the producer (don't attach it late, or re-strip after all late synthesis); don't relax the linker
assert ([non-null IRPtrLit at linker = a HighLevelDecl escaping
stripFrontEndOnlyInstructions](../learnings/1787644362954-non-null-irptrlit-at-linker-a-highleveldecl-escapi.md)).
The related `IREntryPointDecoration` relocation fix (stop attaching at module lowering; let link-time
`specializeIRForEntryPoint` be the single producer) comes with two regressive companion changes to
avoid — don't move `fixEntryPointCallsites` earlier (it asserts on un-specialized higher-order
shapes) and don't harden the constref pass's null-check to a RELEASE_ASSERT (a precompiled `-r`
module from an older compiler bakes the decoration into serialized IR). Bonus: `SLANG_ASSERT(x);
if(!x) return false;` is DEAD in Release because `SLANG_ASSERT`→`__builtin_assume` licenses deleting
the null-check ([entry-point decoration relocation: two seductive-but-wrong companion
fixes](../learnings/1787615422745-slang-entry-point-decoration-relocation-two-seduct.md)).
A second entry-point-callsite crash: compiling an entry point that has an entry-point `uniform`
parameter together with another entry point that *calls* it segfaults (rc 139) on SPIR-V, CUDA and
Metal alike —
`[shader("compute")][numthreads(1,1,1)] void inner(int id : SV_DispatchThreadID, uniform int k)`
called as `inner(id, 3)` from a second `[shader("compute")] outer`, then `slangc x.slang -target
spirv-asm`. Compiling only the caller (`-entry outer`) works, and the crash is already on master
(8d763dd39) [uniform-param entry point called by another entry point segfaults](../learnings/1790767202448-slang-compiling-a-uniform-param-entry-point-togeth.md).

**Why: in `linkAndOptimizeIR`, only the borrow pass updates an entry point's callers.** Several
passes change an entry point's signature in place before `fixEntryPointCallsites` (slang-emit.cpp
:2079 at 837ab4c34) clones it into an ordinary function.
`translateEntryPointInParamToBorrow` (:1100) fixes its call sites (`updateCallSites`,
transform-params-to-constref.cpp:213). Two others do not:
`collectEntryPointUniformParams`/`moveEntryPointUniformParamsToGlobalScope` (:1406/:1415) remove
params, which is the crash above (Debug asserts `index < getParamCount()` at slang-ir.cpp:3168),
and `translateGlobalVaryingVar` (:2073) adds a `BorrowInParam` for a global `in` (#13730 asserts at
specialize-function-call.cpp:246, or segfaults in Release). The arg fix-up in
fix-entrypoint-callsite.cpp:96-97 returns silently on a count mismatch, so the bad call reaches
later passes. When a maintainer blames "in→constref in place", check which pass actually changed the
arity with `-dump-ir-after fixEntryPointCallsites`. The clone/trampoline design history is #8739
(the "Preferred Solution" trampoline; closed by #9869, which never built it) and #12392's comments
(clone or forwarding wrapper at one split point after linking); there is no tracking issue as of
2026-10-19 [only the borrow pass updates callers](../learnings/1792432625744-slang-entry-point-called-as-a-function-only-the-bo.md).

**Turning a silent fallback into a `SLANG_RELEASE_ASSERT` needs every input shape probed, not
a corpus run.** On #13811 (for #13789), R2 replaced the `return typeLayout;` fallback in
`_createOrdinaryPartTypeLayout` (slang-ir-legalize-types.cpp) with
`SLANG_RELEASE_ASSERT(as<IRPointerTypeLayout>(typeLayout))`, because a probe saw only pointer
layouts there and 12k corpus compiles never reached it. Valid code still did: an
`IRExistentialTypeLayout` arrives when an interface-typed parameter is specialized to a concrete
type that mixes data and resources, so a Release build reported E99997 on code that master
compiled. The corpus is blind here because the existential+resource tests
(tests/compute/interface-shader-param*.slang) are DISABLED or report "no tests run". A hand repro
is `interface IFoo{float4 get();} struct Impl:IFoo{float4 v; Texture2D t; ...}` with
`void main(uniform IFoo f, uniform float4 tint, ...)`, compiled with `slangc ... -specialize Impl`;
a global `uniform IFoo` or an `IFoo` field inside a CB/PB needs the API
(`IComponentType::specialize` with `SpecializationArg::fromType(layout->findTypeByName("Impl"))`).
To audit, instrument the fallback to log which subclass reaches it (test
`as<IRExistentialTypeLayout>` and the like; raw `getOp()` numbers do not match a naive parse of
the fiddle enum), then probe existential, pointer, combined-sampler and DescriptorHandle fields
[release-assert catch-all in IR layout code: existential layouts reach it](../learnings/1792594670567-release-assert-catch-all-in-ir-layout-code-existen.md).
Start from the list of `IRTypeLayout` subclasses (struct, array, parameterGroup, pointer,
existential, structuredBuffer, streamOutput, ...) and probe each before asserting a closed set.
IR passes that run before type legalization rebuild layouts, so AST-layout invariants may not hold:
an earlier assert in the same PR ("every kind of the new element is in the old element") broke 3
combined-sampler suite tests, because `lowerCombinedTextureSamplers` builds `Sampler2D` struct
layouts with field layouts but no size attributes. Run the FULL suite after adding any release
assert. CI also runs Debug test jobs, and some shapes (existentials with resources, a
`Ptr<Struct-with-resource>` field) already hit the Debug-only
`SLANG_ASSERT(fieldLayout || !typeLayout)` in the declareVars tuple case on master, so a `.slang`
regression test for them fails Debug CI; use a unit test guarded by
`#ifdef _DEBUG SLANG_IGNORE_TEST`
[enumerate the IRTypeLayout subclasses before release-asserting a closed set](../learnings/1792599445713-before-release-asserting-a-closed-set-of-ir-layout.md).

**Zero coverage-drill hits do not license an assert.** The drill puts `{ FILE* f = fopen("/tmp/drill<pr>.txt","a"); if (f) { fputs("<tag>\n", f); fclose(f); } }` in each guard, rebuilds slangc and slang-test, runs `slang-test -use-test-server -server-count 16`, and counts tags with `sort | uniq -c`; test-server processes write to the same /tmp, so their hits count too. On #13872 it showed in about 25 minutes that 4 of 8 new guards had 0 hits across 11k tests, which is concrete evidence for CLAUDE.md's "silent impossible-shape handling" rule [coverage drill](../learnings/1792692531156-coverage-drill-log-each-defensive-branch-to-a-file.md). But 0 hits shows that the suite does not reach a branch, not that no input does. The fixer then turned the SPIR-V emitter's graceful fallback for a stale `DebugVarStorage` decoration into a `SLANG_RELEASE_ASSERT`, and an audit of passes that clone a function's params before its body found `specializeGenericWithSetArgs`, which crashes ordinary user code at `-g2` (a dynamic-dispatch generic with an `inout` param) and which a `-g2` sweep of all 5310 tests also missed; the mechanism is on [[wiki/concepts/slang-backends-spirv-debug-info-emission.md]]. Before recommending "assert instead of fallback", audit the producer class: grep `transferDecorationsTo|cloneDecoration|cloneInstDecorationsAndChildren` and look for clones that copy params ahead of the body. Unless every producer is covered, prefer a `-validate-ir` rule as the loud check plus a graceful fallback. `SLANG_ASSERT` expands to `[[assume]]` in release builds (`slang-common.h:371`), so a failed one there is undefined behaviour, not a skipped check [a release assert can create user ICEs the suite cannot see](../learnings/1792709180643-turning-a-silent-emitter-fallback-into-a-release-a.md). A worktree's `git submodule update` from the local clone needs `git -c protocol.file.allow=always`, or it fails with "transport 'file' not allowed" [same](../learnings/1792692531156-coverage-drill-log-each-defensive-branch-to-a-file.md).

**`[numthreads]` operands are dangling on targets without specialization constants.** On
HLSL/CPU/CUDA, `collectGlobalUniformParameters` (slang-ir-collect-global-uniforms.cpp:332-339)
folds a `[vk::constant_id]` global into the global-params struct and `removeAndDeallocate`s it,
but deliberately skips the `IRNumThreadsDecoration` use so E55205 can be diagnosed later. The
decoration's operand is then a removed inst with a cleared type, and any pass between collect and
emit that reads that type (e.g. `builder.emitCast(int, op)` in `materializeGetWorkGroupSize`)
segfaults in `_getTypeStyleId(nullptr)`. Touch spec-const-rate operands only on targets that keep
them (an `isSpecConstRateType(op->getFullType())` guard is itself a read of the dead type). The
suite missed it because no test called `WorkgroupSize()` with a spec-const `[numthreads]` on
HLSL/CPU; /code-review found it on #13767 (PR #13826). On SPIR-V, the cast of a `uint` spec const
to `int` is an `OpSpecConstantOp`, and `maybeHoistConstructInstToGlobalScope` then hoists an
all-module-scope `makeVector` to an `OpConstantComposite` with a spec-const constituent, which
spirv-val rejects; skip the hoist when any operand is spec-const rate
[[numthreads] operands on non-spec-const targets are dangling](../learnings/1792609336816-slang-numthreads-operands-on-non-spec-const-target.md).
The missing casts in that splice are on [[wiki/concepts/slang-b-language-semantics.md]].

## Subsumption, wrappers, and value-shape completeness

"Guard A subsumes guard B" is a claim about the full consumer set each protects. On #12623 a
transitive "never defer a func reachable from a static_assert" gate was claimed to subsume the
producer-side `!isFromCoreModule` guard; the broad `tests/cuda` suite falsified it — core-module
`[ForceInline]` helpers fold into consumers OTHER than static_assert (an intrinsic operand IR
validation requires be an integer literal), a consumer the use-site walk structurally can't see. The
two guards cover disjoint consumer classes; keep both, and let the broad regression suite (not the
one motivating test) expose a false subsumption ([reachability-from-static_assert does NOT subsume a
core-module force-inline guard](../learnings/1787658437191-reachability-from-static-assert-does-not-subsume-a.md)).

The same full-consumer-set question decides an inherited-field ICE (#13348). `h.p.baseField`, where
`p` is a get/set or `ref` property/subscript returning `struct Derived : Base`, crashes lowering with
E99997 "unexpected member flavor". `emitCastToConcreteSuperTypeRec` (`slang-lower-to-ir.cpp:7330`)
calls `extractField` with an `InheritanceDecl`, and for a BoundMember/BoundStorage base
`extractField` defers it into `BoundMemberInfo` (:1153-1167). All THREE consumers of
`BoundMemberInfo::declRef` accept `VarDecl` but not `InheritanceDecl`: `materialize` (:1263 →
abort :1278), `tryGetAddress` (:10288, silent fall-through) and `assign` (:10720 → :10741). Fixing
`materialize` alone is insufficient; a prototype accepting `InheritanceDecl` at all three sites,
narrowed to struct bases (interface inheritance lowers to a requirement key at :11434), fixes every
shape. The supported builtin shape `RWStructuredBuffer<Derived> buf; buf[0].baseField` fails too,
for both read and write; get-only properties and `StructuredBuffer` reads are fine. It is not a
regression (2025.23.2 fails too). When validating, test with get/set or buffer shapes, because a
user-written `ref` accessor still emits invalid HLSL/SPIR-V/CPU for the independent #9636. Under
`-std 2026` user struct→struct inheritance is E30811, but core-module decls are exempt
[inherited-field access through BoundStorage/BoundMember ICEs at three consumers](../learnings/1790788517757-inherited-field-access-through-boundstorage-boundm.md).

`CoerceToProperTypeImpl` has THREE failure representations, not the two the issue named: null out-param,
`getErrorType()` (only inside `if(diagSink)`), and `return false` without touching the out-param
(leaving a stale non-null type). The cleanest fix normalizes at the `CoerceToProperType` wrapper on
the bool the Impl already returns — one source of truth — while `tryCoerceToProperType` must keep
returning null (overload resolution relies on null == "candidate not viable") ([CoerceToProperType
null-vs-ErrorType: fix the wrapper, not
tryCoerce](../learnings/1787657808750-coercetopropertype-null-vs-errortype-fix-the-wrapp.md)).

Two miscompiles round out the cluster. The CUDA surface-stride-through-a-param bug (#12737) is a
documented structural limitation, reproducible from a plain compile (`-target cuda` prints the
generated text): `_findImageFormatDecoration` recovers `[format]` only from the resource's own inst
or a load-of-global-field, never through an `IRParam`, and the principled fix is producer-side
specialization of formatted resource params — so DON'T label it `regression` ([CUDA surface stride +
format-through-param is compile-time verifiable and structurally
documented](../learnings/1787665524776-cuda-surface-stride-format-through-param-is-compil.md)).
The partial-init struct-return spurious varying store (#12756) reaches emit as
`fieldExtract(load(unpromoted var))`, not an `IRUndefined` (the local mixes per-field stores with a
whole-struct load, defeating mem2reg) — so a narrow `as<IRUndefined>` guard is incomplete; fix in
glsl-legalize's `assign` (`address ← value`) to skip a provably-uninitialized store, handling both
shapes ([partial-init struct return: undef varying store is fieldExtract(load(unpromoted var)), not
IRUndefined](../learnings/1787708099936-partial-init-struct-return-undef-varying-store-is-.md)).
And the nested swizzle-of-swizzle vector lvalue (#12768) miscompiles from two compounding defects in
`LValueExprLoweringVisitor::visitSwizzleExpr`: `.add((uint32_t)elementCount)` pushes the count as one
index (should `.setCount`), and the `backpermute` lambda takes its output param by value (should
`auto&`) — the matrix sibling only worked because its output is a raw C-array that decays to a
pointer ([nested swizzle-of-swizzle vector lvalue miscompiles (backpermute by-value + add-count
bug)](../learnings/1787736858261-slang-nested-swizzle-of-swizzle-vector-lvalue-misc.md)).
It is a true old regression: the same source compiled correctly on v2024.1.34 and is broken on
v2025.12.1 ([#12768 worked on v2024.1.34, broken on v2025.12.1](../learnings/1792154620818-12768-nested-swizzle-lvalue-did-work-on-v2024-1-34.md)).
Swizzle stores into textures have their own shape gap. `assign()` in `slang-lower-to-ir.cpp`
emits `swizzledStore` for every swizzle of more than one element, including full-coverage ones
such as `t[i].xyzw = v` (or `.xy` on a `float2` texel), so `legalizeImageSubscript` lowers them as a
read-modify-write: a needless image load on every target, a CUDA-only false E56006 warning since
PR #13363, and a hard CUDA E55204 on a format-converted `[format("rgba8")] RWTexture2D<float4>`
(no converting read exists) even though `t[i] = v` compiles. The fix belongs in `legalizeStore`:
when the swizzle indices are a permutation of all of `imageElementType`'s components, emit a plain
imageStore of the reordered source. `RWBuffer` never reaches CUDA surface emit (capability check
E36107 rejects it first), and `tests/bugs/gh-4411.slang` (scalar-texel `.x =`) is the canonical
scalar whole-texel store through `ref`
[full-coverage swizzle on RWTexture goes through the RMW path](../learnings/1790832459014-full-coverage-swizzle-on-rwtexture-goes-through-th.md).
The follow-up fix showed that "full coverage" must be measured against the texel the image op
actually writes, not against the texture's element type. On Metal, GLSL and SPIR-V that texel is
always a 4-vector, so treating `t[i].yx = v` on `[format("rgba32f")] RWTexture2D<float2>` as full
coverage would zero `.zw` of the wider backing format; on CUDA the texel is the element type
(`surf*write<T>` writes `sizeof(T)` bytes), so there the shortcut does apply to `float2`. Pin both
directions with GLSL, Metal and SPIR-V CHECKs, and test a non-self-inverse swizzle (`.yzwx` must
become `v.wxyz`): `.wzyx` and `.yx` pass even when the component mapping is reversed
[image-subscript RMW shortcut: compare against the image op's texel width](../learnings/1791084184485-image-subscript-rmw-shortcut-compare-a-swizzle-aga.md).
Both fixes live in the image-subscript pass, which sees only some texture stores. Assignment through
a bound subscript in `slang-lower-to-ir.cpp` tries the `set` accessor before `ref`, so a whole-texel
store such as `t[i] = v` or `t.Store(i, v)` becomes the `Store` intrinsic (spelled on CUDA through
`$C`/`$E` in hlsl.meta.slang). Only swizzle or member writes (`t[i].x = v`, `t[i].xyzw = v`) go
through `ref` and produce the `kIROp_ImageSubscript` + `Store`/`SwizzledStore` that
`legalizeImageSubscript` rewrites. A rule in that pass, such as #13363's E56007 conversion check,
therefore never sees plain stores, and the two spellings can diverge, with one compiling and the
other erroring. Before claiming a pass "rejects store X", run master slangc with `-dump-ir`, count
`imageSubscript` insts, and compare `t[i] = v` with `t[i].x = v`
[plain `tex[i] = v` lowers via the setter, not kIROp_ImageSubscript](../learnings/1792030315427-slang-plain-tex-i-v-lowers-via-the-setter-not-kiro.md).

**Source learnings (24):**
- [ParseModifiers on a decl whose name can be a bareword keyword breaks previously-valid code](../learnings/1787558855449-parsemodifiers-on-a-decl-whose-name-can-be-a-barew.md) — use bracket-only ParseSquareBracketAttributes; test with a case/field named `point`/`linear`.
- [ByteAddressBuffer.Load of struct with empty/zero-size field emits Load<void>](../learnings/1787580105549-byteaddressbuffer-load-of-struct-with-empty-zero-s.md) — add a natural-size-0 skip in emitLegalLoad/Store field loops.
- [getDefaultVal on AssocTypeDecl built an empty IRMakeStruct](../learnings/1787585281811-slang-getdefaultval-on-assoctypedecl-built-an-empt.md) — producer-side emitDefaultConstruct; assert consumer with EXACT ==, not min-bound.
- [Array of ConstantBuffer with resource element crashes type-legalization](../learnings/1787601573078-array-of-constantbuffer-with-resource-element-cras.md) — legalizeGetElement value-path lacks an implicitDeref case; trigger is the resource, not zero-size.
- [Slang entry-point decoration relocation: two seductive-but-wrong companion fixes](../learnings/1787615422745-slang-entry-point-decoration-relocation-two-seduct.md) — don't move fixEntryPointCallsites early; SLANG_ASSERT+if guard is dead in Release.
- [Slang tess patch-constant user-output location bug is a 3-way classification gap](../learnings/1787640266798-slang-tess-patch-constant-user-output-location-bug.md) — user semantic falls through if(decoration){if(sv_)}; verify by IR dump.
- [CORRECTION: user patch-constant field misses Location via a fall-through, not a shared counter](../learnings/1787641994236-correction-user-patch-constant-field-misses-locati.md) — kIROp_PatchDecoration alone fixes it; Patch vars get a separate location set.
- [Non-null IRPtrLit at linker = a HighLevelDecl escaping stripFrontEndOnlyInstructions](../learnings/1787644362954-non-null-irptrlit-at-linker-a-highleveldecl-escapi.md) — strip runs only in front-end lowering; fix late-synthesis producer, not the linker assert.
- [CoerceToProperType null-vs-ErrorType: fix the wrapper, not tryCoerce](../learnings/1787657808750-coercetopropertype-null-vs-errortype-fix-the-wrapp.md) — three failure representations; normalize at the wrapper; keep tryCoerce returning null.
- [Reachability-from-static_assert does NOT subsume a core-module force-inline guard](../learnings/1787658437191-reachability-from-static-assert-does-not-subsume-a.md) — two guards cover disjoint consumers; the broad regression suite exposes false subsumption.
- [CUDA surface stride + format-through-param is compile-time verifiable and structurally documented](../learnings/1787665524776-cuda-surface-stride-format-through-param-is-compil.md) — structural limitation (format not recoverable through IRParam), not a regression.
- [Partial-init struct return: undef varying store is fieldExtract(load(unpromoted var)), not IRUndefined](../learnings/1787708099936-partial-init-struct-return-undef-varying-store-is-.md) — an as<IRUndefined> guard is incomplete; fix in glsl-legalize assign, handle both shapes.
- [Slang nested swizzle-of-swizzle vector lvalue miscompiles](../learnings/1787736858261-slang-nested-swizzle-of-swizzle-vector-lvalue-misc.md) — .add(count) should be .setCount; backpermute output param must be auto&.
- [Uniform-param entry point compiled with an entry point that calls it segfaults (all targets)](../learnings/1790767202448-slang-compiling-a-uniform-param-entry-point-togeth.md) — rc 139 on spirv/cuda/metal; `-entry outer` alone works; hypothesis: `moveEntryPointUniformParamsToGlobalScope` arity mismatch.
- [Slang entry point called as a function: only the borrow pass updates callers](../learnings/1792432625744-slang-entry-point-called-as-a-function-only-the-bo.md) — confirms the uniform-param arity mismatch; `translateGlobalVaryingVar` (#13730) also skips callers; fix-up returns silently on count mismatch; #8739/#12392 trampoline history
- [Inherited-field access through BoundStorage/BoundMember ICEs at three VarDecl-only consumers (#13348)](../learnings/1790788517757-inherited-field-access-through-boundstorage-boundm.md) — materialize/tryGetAddress/assign all need `InheritanceDecl` (struct bases only); `buf[0].baseField` fails too; `ref` accessors confounded by #9636.
- [Full-coverage swizzle on RWTexture goes through the RMW path (false E56006 / E55204 on CUDA)](../learnings/1790832459014-full-coverage-swizzle-on-rwtexture-goes-through-th.md) — fix in `legalizeStore`: a component permutation becomes a plain imageStore.
- [skip the texel read only when the swizzle covers the image op's texel (4-vector on Metal/GLSL/SPIR-V, element type on CUDA); test a non-self-inverse swizzle; don't rebuild during an A/B run (exit 127)](../learnings/1791084184485-image-subscript-rmw-shortcut-compare-a-swizzle-aga.md)
- [Slang: plain `tex[i] = v` lowers via the setter, not kIROp_ImageSubscript](../learnings/1792030315427-slang-plain-tex-i-v-lowers-via-the-setter-not-kiro.md) — `set` before `ref`; only swizzle/member writes reach `legalizeImageSubscript`, so image-subscript rules (#13363 E56007) miss plain stores; count `imageSubscript` in `-dump-ir` two-sided
- [Release-assert 'catch-all' in IR layout code: existential layouts reach it — test with slangc -specialize](../learnings/1792594670567-release-assert-catch-all-in-ir-layout-code-existen.md) — #13811 R2 `_createOrdinaryPartTypeLayout` assert broke Release on an interface param specialized to data+resource; corpus tests disabled; instrument the fallback
- [Before release-asserting a closed set of IR layout shapes, enumerate the IRTypeLayout subclasses](../learnings/1792599445713-before-release-asserting-a-closed-set-of-ir-layout.md) — probe each subclass; pre-legalization passes rebuild layouts (combined-sampler, no size attrs); Debug-only declareVars assert forces a `_DEBUG`-ignored unit test
- [Slang: [numthreads] operands on non-spec-const targets are dangling (null type) — never read their type](../learnings/1792609336816-slang-numthreads-operands-on-non-spec-const-target.md) — `collectGlobalUniformParameters` removes the spec const but skips the decoration use; `materializeGetWorkGroupSize` cast segfaults (#13826); don't hoist spec-const makeVector on SPIR-V
- [Turning a silent emitter fallback into a release assert can create user ICEs that the test suite cannot see](../learnings/1792709180643-turning-a-silent-emitter-fallback-into-a-release-a.md) — #13872: 0 drill hits, then `specializeGenericWithSetArgs` ICE at -g2; audit cloners first; `SLANG_ASSERT` is `[[assume]]` in release
- [Coverage drill: log each defensive branch to a file, run the full suite](../learnings/1792692531156-coverage-drill-log-each-defensive-branch-to-a-file.md) — fopen/fputs tag per guard + 16-server suite run; 4 of 8 #13872 guards had 0 hits; `protocol.file.allow=always` for worktree submodules
