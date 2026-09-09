---
title: Slang Compiler Bug Root Causes — IR Lowering, Codegen, and Legalization
type: concept
group: misc
tags: [slang, ir-lowering, codegen, legalization, glsl-legalize, cuda, spirv, byte-address-buffer, producer-fix]
source_count: 13
---

## TL;DR

Verified root-cause traces for a cluster of Slang compiler crashes/miscompiles, all resolved at the
producer/IR layer rather than by masking in emit. Common shape: an early classifier or lowering pass
mishandles an input shape, and the crash surfaces far downstream in codegen or the linker.

- **`if(decoration){ if(sv_){...} }` with the real work in the sibling `else` silently drops the
  middle case** — a user semantic (not `sv_`) enters the outer `if`, does nothing, and never reaches
  the `else`'s allocator. This is the tess patch-constant Location-0 collision (a classification
  fall-through, NOT a shared-counter race); fix = add the `kIROp_PatchDecoration` so per-patch vars
  occupy a separate location set. Verify a "defaults to 0 / missing offset" symptom by IR dump.
- **A zero-size/void struct field has no byte-address skip** → `.Load<void>` emitted, DXIL/SPIRV/GLSL
  fail. Add a natural-size-0 skip in the `emitLegalLoad`/`emitLegalStore` field loops, mirroring the
  void-field skip already in buffer-element-type lowering.
- **`getDefaultVal` on an `AssocTypeDecl` (an `AggTypeDecl`) built a zero-operand `IRMakeStruct`**
  over an opaque type → positional-OOB after type-flow specialization. Fix producer-side with
  `emitDefaultConstruct`; assert the consumer with EXACT `==`, not a min-bound.
- **Array + ConstantBuffer + resource element** crashes type-legalization because
  `legalizeGetElement` (value path) has no `implicitDeref` case. The trigger is the resource, not
  "zero-size."
- **A non-null `IRPtrLit` reaching the linker** = a `HighLevelDecl` decoration on a *late-synthesized*
  inst that escaped `stripFrontEndOnlyInstructions` (which runs only during front-end lowering, not
  in linkIR). Fix the producer; don't relax the linker assert.
- **`IREntryPointDecoration` relocation** has two seductive-but-wrong companion fixes; and
  `SLANG_ASSERT(x); if(!x)…` is DEAD in Release (`__builtin_assume` deletes the null-check).
- **CUDA surface-stride-through-a-param** is a documented structural limitation (`_findImageFormat`
  can't recover `[format]` through an `IRParam`), NOT a regression.
- **A partial-init struct's spurious varying store is `fieldExtract(load(var))`, not `IRUndefined`**
  — an `as<IRUndefined>` guard is incomplete; handle both shapes in glsl-legalize's `assign`.
- **Nested swizzle-of-swizzle vector lvalue** miscompiles from a `.add(count)` (should be
  `.setCount`) plus a by-value lambda output param (should be `auto&`).
- **`CoerceToProperTypeImpl` has THREE failure representations, not two** — normalize at the wrapper.
- **"guard A subsumes guard B" is a claim about the FULL consumer set of each** — a `static_assert`
  reachability walk and `isFromCoreModule` cover disjoint consumers; keep both.

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

## Subsumption, wrappers, and value-shape completeness

"Guard A subsumes guard B" is a claim about the full consumer set each protects. On #12623 a
transitive "never defer a func reachable from a static_assert" gate was claimed to subsume the
producer-side `!isFromCoreModule` guard; the broad `tests/cuda` suite falsified it — core-module
`[ForceInline]` helpers fold into consumers OTHER than static_assert (an intrinsic operand IR
validation requires be an integer literal), a consumer the use-site walk structurally can't see. The
two guards cover disjoint consumer classes; keep both, and let the broad regression suite (not the
one motivating test) expose a false subsumption ([reachability-from-static_assert does NOT subsume a
core-module force-inline guard](../learnings/1787658437191-reachability-from-static-assert-does-not-subsume-a.md)).

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

**Source learnings (13):**
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
