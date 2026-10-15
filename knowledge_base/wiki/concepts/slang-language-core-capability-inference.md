---
title: "Slang capability inference: how [require] propagates through referenced declarations"
type: concept
group: slang-language-core
tags: [slang, capability, require, capability-inference, generics, GenericAppDeclRef, MemberDeclRef, CapabilityDeclReferenceVisitor, E36104, E36107, E36108, E36118, parity-testing]
source_count: 6
---

# Slang capability inference: how [require] propagates through referenced declarations

Slang infers a function's capability requirements by walking the declarations it references and joining their `[require(...)]` sets. A `[require]` that the walk never reaches is silently dropped: the code compiles for a target the type or function was restricted away from, with no E36107. This page covers the decl-ref walk in `slang-check-decl.cpp`, the generic-struct gap fixed for #13579 by PR #13616, the traps in hooking a new reference path, the walks inference still does not make, and how to test a fix that removes a generic-vs-non-generic difference. Target-family gating of IR passes and other target-coverage questions are on [slangc Target Coverage & Capability Gating](slangc-target-coverage-and-capabilities.md); derivative `[require]` threading is on [[wiki/concepts/slang-autodiff-require-and-variants.md]]; the descriptor-handle capability promotion is on [[wiki/concepts/slang-language-core-descriptor-handle-capabilities-and-reflection.md]].

## TL;DR

- **Inference reaches a type's `[require]` only through the decl-refs it walks.** `SemanticsDeclReferenceVisitor::visitVal` skips Decl-kind operands, so before PR #13616 a `GenericAppDeclRef` (`Foo<3>`) or a member-of-generic decl-ref never contributed the struct's `[require]`; only `visitDirectDeclRef` did.
- **Hook a new path at the decl-ref level** (`visitGenericAppDeclRef` / `visitMemberDeclRef`), not at `visitDeclRefType`: a static member call `Foo<3>.make()` reaches the visitor as a `MemberDeclRef` with no type node.
- **Put capability policy in `CapabilityDeclReferenceVisitor`**, not the shared `SemanticsDeclReferenceVisitor`, which also drives `CollectReferencedDeclsVisitor` (forward-reference and extension generic-param checks).
- **A new `processReferencedDecl` path must call `ensureDecl(decl, CapabilityChecked)` first**, skipping decls whose check state `isBeingChecked()`. The caps argument is read before `_propagateRequirement` runs its own `ensureDecl`, so a struct declared later in the file contributes null caps, is marked visited, and its requirement is lost for good.
- **Match `StructDecl || EnumDecl`.** `StructDecl` alone misses generic enums and enums nested in a generic struct; full `AggTypeDecl` also takes in interfaces and associated types.
- **Do not change the exclusion set by module or magic-ness.** Processing every `DeclRefBase` breaks the core-module bootstrap; skipping `__intrinsic_type`/`__magic_type` also skips standard-module types with their own `[require]`; scoping to `isFromCoreModule` pulls stage-restricted view types into helper inference.
- **Two walks are still missing:** `visitFunctionDeclBase` never visits `returnType`, and the base `visitStaticMemberExpr` never calls `processDeclModifiers`. Check the walk before writing "general inference already covers X".
- **Making a type's `[require]` visible mostly surfaces E36108** on public `[require(X)]` functions; E36104 appears only when the type's set is a superset of the declared target.
- **After any visitor change, rebuild the core module and diff its log for `(error|warning)[E…]`,** and diff every SIMPLE directive's raw output with and without the change before claiming a test is re-enabled.
- **Pin a parity fix with twin rows:** each generic row next to its non-generic twin in one exhaustive DIAGNOSTIC_TEST, master failing exactly the generic rows. Before calling a changed diagnostic a regression, run the non-generic twin on master.
- **A debug-only `SLANG_ASSERT` on a guard that a counting probe never hits beats a silent skip.**

## The walk, and the generic decl-ref gap (#13579)

Capability inference visits each referenced declaration through `CapabilityDeclReferenceVisitor`, built on the shared `SemanticsDeclReferenceVisitor`. `SemanticsDeclReferenceVisitor::visitVal` skips Decl-kind operands, so a `GenericAppDeclRef` (whose inner `StructDecl` is operand 0) or a member-of-generic decl-ref never contributes the struct's `[require]`; only `visitDirectDeclRef` does. That is why `[require]` on a generic struct was dropped in #13579 while the same attribute on a non-generic struct gave E36107. Processing every `DeclRefBase`'s `getDecl()` breaks the core-module bootstrap (57 errors), while restricting it to user aggregates builds clean [DIAGNOSTIC_TEST has no -NOT directive](../learnings/1791842377952-diagnostic-test-has-no-not-directive-prefix-not-li.md). PR #13616 adds `CapabilityDeclReferenceVisitor::visitGenericAppDeclRef` and `visitMemberDeclRef`, both routing to `referenceStructOfDeclRef` [a new processReferencedDecl path must ensureDecl first](../learnings/1791933462633-slang-capability-inference-a-new-processreferenced.md).

## Hooking a new reference path

Three rules came out of PR #13616 [a new processReferencedDecl path must ensureDecl first](../learnings/1791933462633-slang-capability-inference-a-new-processreferenced.md).

First, `processReferencedDecl` calls `handleProcessFunc(decl, decl->inferredCapabilityRequirements, loc)`, and that capability argument is evaluated before `_propagateRequirement` runs its own `ensureDecl`. A new path therefore calls `ensureDecl(decl, CapabilityChecked)` itself. Without that, a struct declared later in the file contributes null caps, and because its decl-ref is now marked visited the requirement never comes back. The extension check already documents the same trap. Mirror `_propagateRequirement`'s skip of a decl whose `checkState.isBeingChecked()`, or a self-referencing type reports a CyclicReference error.

Second, hook decl-refs, not types. A static member call such as `Foo<3>.make()` reaches the visitor as `MemberDeclRef(make, GenericAppDeclRef(Foo, …))` with no type node, so a `visitDeclRefType` hook never sees it.

Third, the policy belongs in `CapabilityDeclReferenceVisitor`. `SemanticsDeclReferenceVisitor` also drives `CollectReferencedDeclsVisitor`, which implements the forward-reference and extension generic-parameter checks, so a change there alters unrelated diagnostics.

## Which declarations to match: `StructDecl || EnumDecl`

PR #13616 first filtered `referenceStructOfDeclRef` on `as<StructDecl>`. That leaves `[require(metal)] enum GE<let N:int>` and `Outer<3>.E` (an enum nested in a generic struct) silent for HLSL, while a non-generic `[require]` enum gives E36107. Widening the filter to `StructDecl || EnumDecl` fixes both: the core module builds with no diagnostics, metal still compiles, 2912/2912 tests pass and a 4770-invocation SIMPLE byte-compare is clean. Devin caught the enum gap; the in-house correctness reviewer filed only the member-function variant [a StructDecl-only hook misses generic enums](../learnings/1791937885563-slang-capability-inference-a-structdecl-only-hook-.md).

Full `AggTypeDecl` was rejected because it also covers interfaces and associated types: the associated-type provenance notes move from the interface to `associatedtype A`, and `[require(hlsl)] struct S : IGen<int>` fires E36118 [a new processReferencedDecl path must ensureDecl first](../learnings/1791933462633-slang-capability-inference-a-new-processreferenced.md). The E36118 is not a regression, though. Master already emits it for the non-generic `[require(hlsl)] struct S : ING`, so the generic spelling now merely matches its twin (see the parity section below) [check the non-generic twin first](../learnings/1791941121185-before-calling-a-new-capability-diagnostic-a-regre.md).

## Excluding intrinsic types: two scoping traps

A fix that copies `collectGenericStructTypeUses`'s rule (skip `__magic_type`/`__intrinsic_type` aggregates) also skips standard-module types declared `__intrinsic_type(...)` with their own `[require]`, for example slang.raytracing's `rt::MultiLevelAccelerationStructure<N>` (`[require(metal)] __intrinsic_type(RaytracingAccelerationStructure)`), so tests that depend on them keep passing silently. Limiting the exclusion to core-module decls (`isFromCoreModule`) does propagate them, but it also pulls stage-restricted view types (`[require(structural_raytracing_*)]` ClosestHitInput and similar) into helper inference: on fork kaizhangNV/slang@5dd28dd2e8 that moved and added E36100 diagnostics and dropped one E36107 across 4 of 219 `tests/ray-tracing-2` directives. A fast fork build for `-no-codegen` checks is `-DSLANG_ENABLE_TESTS=OFF -DSLANG_ENABLE_DXIL=OFF -DSLANG_SLANG_LLVM_FLAVOR=DISABLE` (DXIL ON builds DXC from source; `SLANG_ENABLE_TESTS` requires `SLANG_ENABLE_SLANG_RHI`) [capability-inference fixes that skip __intrinsic_type miss standard-module types](../learnings/1791852083392-capability-inference-fixes-that-skip-intrinsic-typ.md).

## Walks inference still does not make

In `slang-check-decl.cpp`, `SemanticsDeclCapabilityVisitor::visitFunctionDeclBase` walks the function's direct member decls (its parameters), its body and the parent aggregate, but never `returnType`. A `[require(metal)] struct MN` named only by an entry point's return type (`MN main()`) therefore compiles silently for HLSL. Only `collectGenericStructTypeUses` in `validateEntryPoint` catches the generic form `MG<3> main()`. Separately, the base `visitStaticMemberExpr` dispatches only the decl-ref and never calls `processDeclModifiers`, so a `[require]` on the member itself of `G<3>.make()` is dropped; the non-generic `S.make()` folds to `DirectDeclRef(make)` and is caught. The PR #13616 reviewer caught a code comment claiming "general inference already covers" the return-type case, so read the walk before writing such a claim [inference never walks a function's return type](../learnings/1791953844275-slang-capability-inference-never-walks-a-function-.md).

The member-level case resisted two quick fixes on PR #13616: adding `processDeclModifiers` to the base `visitStaticMemberExpr`, and including `__intrinsic_type` generics in the new hook. Both broke the core-module build (E36104 at `coopVecLoad`, E36120) [a new processReferencedDecl path must ensureDecl first](../learnings/1791933462633-slang-capability-inference-a-new-processreferenced.md).

## Breaking surface and verification

Making a type's `[require]` visible breaks user code mostly through E36108 (dependencies not compatible on target) on public `[require(X)]` functions, not E36104. E36104 shows up only when the type's capability set is a superset of the declared target, for example spirv plus an extension against plain spirv [a StructDecl-only hook misses generic enums](../learnings/1791937885563-slang-capability-inference-a-structdecl-only-hook-.md).

Any change to these visitors runs against the core module first, so rebuild it and diff `build.log` for `(error|warning)[E…]` [a new processReferencedDecl path must ensureDecl first](../learnings/1791933462633-slang-capability-inference-a-new-processreferenced.md). Before claiming a capability fix re-enables a test, diff every SIMPLE directive's raw output with and without the change [capability-inference fixes that skip __intrinsic_type miss standard-module types](../learnings/1791852083392-capability-inference-fixes-that-skip-intrinsic-typ.md). When keeping a drill binary for such byte-compares, do not copy a Release `bin/`+`lib/` tree elsewhere: OptiX header lookup breaks (`nvrtc: Failed to locate OptiX headers`) and `tests/cuda/optix-*` rows diverge spuriously, so treat those as environment artifacts [a StructDecl-only hook misses generic enums](../learnings/1791937885563-slang-capability-inference-a-structdecl-only-hook-.md).

## Testing a parity fix: twin rows, and the twin before a regression claim

A fix like #13616 removes a dependence on whether a type is spelled generically. Reviewers accept the tests as pinning it when each generic row sits next to its non-generic twin in the same exhaustive DIAGNOSTIC_TEST and the master binary fails exactly the generic rows while passing every twin; on #13616 that was 18/33 on master and 33/33 with the fix [pin a parity fix with twin rows](../learnings/1791946199459-pin-a-generic-vs-non-generic-parity-fix-with-twin-.md).

The same framing decides whether a changed diagnostic is a regression. The question for each diagnostic that changes is "does the generic spelling now match its non-generic twin on master?", not "is it new versus master?". On #13616 both the fixer and a reviewing approver reported E36118 on `[require(hlsl)] struct S : IGen<int>` as a regression, but master already gave E36118 for `S : ING`, so it was parity. Put each probe shape in its own file: E36118 is reported per declaration for every struct in the file, so combining shapes makes the per-entry output misleading [check the non-generic twin first](../learnings/1791941121185-before-calling-a-new-capability-diagnostic-a-regre.md), [pin a parity fix with twin rows](../learnings/1791946199459-pin-a-generic-vs-non-generic-parity-fix-with-twin-.md).

For a guard condition that should be impossible, a debug-only `SLANG_ASSERT` is preferable to a silent skip once a counting probe shows it never fires (0 of 2,337 test files on #13616), and reviewers accept it [pin a parity fix with twin rows](../learnings/1791946199459-pin-a-generic-vs-non-generic-parity-fix-with-twin-.md).

**Source learnings (6):**
- [DIAGNOSTIC_TEST has no -NOT directive (capability-propagation half)](../learnings/1791842377952-diagnostic-test-has-no-not-directive-prefix-not-li.md) — `visitVal` skips Decl-kind operands, so `GenericAppDeclRef` drops `[require]`; all-DeclRef fix breaks bootstrap
- [Capability-inference fixes that skip __intrinsic_type miss standard-module generic types too](../learnings/1791852083392-capability-inference-fixes-that-skip-intrinsic-typ.md) — `rt::MultiLevelAccelerationStructure`; `isFromCoreModule` scoping shifts E36100/E36107 in 4/219 directives; fast fork build flags
- [Slang capability inference: a new processReferencedDecl path must ensureDecl(CapabilityChecked) first, and hook decl-refs, not types](../learnings/1791933462633-slang-capability-inference-a-new-processreferenced.md) — null caps from later-declared structs; `MemberDeclRef` with no type node; policy in `CapabilityDeclReferenceVisitor`; failed attempts break core module
- [Slang capability inference: a StructDecl-only hook on GenericAppDeclRef misses generic enums](../learnings/1791937885563-slang-capability-inference-a-structdecl-only-hook-.md) — widen to `StructDecl || EnumDecl`; E36108 is the main breaking surface; OptiX artifact from copied Release trees
- [Slang capability inference never walks a function's return type; static member access skips processDeclModifiers](../learnings/1791953844275-slang-capability-inference-never-walks-a-function-.md) — `MN main()` silent for HLSL; member-level `[require]` on `G<3>.make()` dropped
- [Pin a generic-vs-non-generic parity fix with twin rows, and check the twin before calling a diagnostic a regression](../learnings/1791946199459-pin-a-generic-vs-non-generic-parity-fix-with-twin-.md) — 18/33 on master vs 33/33; debug-only `SLANG_ASSERT` over silent skip

_Catalog: [[wiki/index.md]]_
