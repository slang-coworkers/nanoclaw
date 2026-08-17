---
title: "Slang Autodiff & Differentiation: Internals and Design Rules"
type: concept
group: slang-autodiff-ir
tags: [autodiff, differentiation, transpose, derivative-variants, purity, capability, member-methods, witness-tables]
source_count: 12
---

# Slang Autodiff & Differentiation: Internals and Design Rules

Slang's automatic differentiation (autodiff) system is one of the most complex subsystems in the compiler. This page collects hard-won knowledge about its internal invariants and design rules — the transpose pass, derivative variant tracking, member-method handling, purity checks, capability propagation, operator design, and recursive witness-table walks. Performance regressions, target/conditional bugs, verification conventions, and the recent incident folds live in the companion page [[wiki/concepts/slang-autodiff-ir-autodiff-differentiation-2.md]].

## TL;DR

- **Transpose pass gradient narrowing:** when extracting the differential field of a pair-typed value, narrow the `aggPrimalType`/`aggregatePrimalType` to the pair's inner primal type at ALL `emitDAddOfDiffInstType` call sites — not just the gradient. A single un-narrowed aggregation type re-drives `DiffPair.dadd` dispatch and reinstates the malformed IR ("Unrecognized field. Cannot emit field accessor").
- **Diagnostic shortcut for malformed-IR crashes:** a one-shot `fprintf` in `emitFieldAccessor`'s `SLANG_UNEXPECTED` branch dumping `baseInst` + parent function pinpoints the moment the bad IR appears — far faster than `-dump-ir-before/-after`.
- **Derivative variants are tracked via `tryGetAssociationOfKind` / `getAssociatedDeclsForDecl`, NOT raw `IRForwardDerivativeDecoration` iteration or `getModifiersOfType<UserDefinedDerivativeAttribute>()`.** Raw iteration misses specialized/generic instantiations and inverse-direction (`[ForwardDerivativeOf]`) placements — the inverse path calls `registerAssociatedDecl` but never `addModifier`.
- **Member-method autodiff has many independently-edited sites that must agree** (four AST resolvers + `ApplyForBwdFuncType` IR translator + front-end `InvokeExpr` lowering). The gate for auto-prepending `this` is `callableDecl->hasModifier<NoDiffThisAttribute>()` (that exact class name) — NOT a `static`/ctor axis, which injects a surplus argument for default-differentiable-`this` methods.
- **Derivative-variant purity gate must accept `[PreferRecompute]` as purity-equivalent to `[__readNone]`.** Built-in math derivatives use `[PreferRecompute]`; `checkAutoDiffUsages` runs before `propagateFuncProperties`. Exclude `SideEffectBehavior.Allow`; recurse through `IRTranslateBase`/`IRSpecialize`/`IRGeneric` wrappers.
- **Gate derivative→primal capability propagation on explicit `[require]`.** Without it, target-specialized derivative families join their requirements onto all-targets builtins and silently abort core-module compilation.
- **Sibling diff operators must honor the same user derivative override** — auto-synthesizing while a sibling dispatches to `[BackwardDerivative]` causes silent numerical divergence or outright breakage. The correct default is to compose (call `f` for the value + the existing override for gradients).
- **Return-shape rule for new diff operators:** if the operator PRODUCES the return's differential, use `DifferentialPair<R>` (forward mode); if it CONSUMES it as input, use bare `R` (backward mode). Cosmetic symmetry is not a reason to force pair-wrapping.
- **Any recursive walk over witness-table-valued entries needs a `HashSet<IRWitnessTable*>` cycle guard** — autodiff's `buildDifferentiablePairWitness` deliberately creates a self-referential witness-table entry. "Nested witness tables form an acyclic tree" is FALSE in well-formed IR.

## Transpose Pass and Gradient Type Mismatches

The transpose pass (`source/slang/slang-ir-autodiff-transpose.cpp`) is a common site for subtle type mismatches when extracting differential fields from `DiffPair`-typed values.

When `transposeLoad` extracts the differential field of a pair-typed loaded value to make gradients bare-diff, the `aggPrimalType` passed to `emitAggregateValue` must also be narrowed to the pair's inner primal type — otherwise `emitDAddOfDiffInstType` dispatches via `DiffPair.dadd`, whose inlined body applies pair-typed accessors (`GetPrimal`/`GetDifferential`) to bare-diff arguments and crashes with `"Unrecognized field. Cannot emit field accessor"` ([slang autodiff transpose: bare-diff gradient with DiffPair aggPrimalType causes crash](wiki/learnings/1779432739908-slang-autodiff-transpose-bare-diff-gradient-with-d.md)).

Three-site narrowing (transposeMakePair ~line 1700, materializeDifferentialPairGetElementGradients ~line 2660, transposeLoad ~line 1611) is **necessary but not sufficient**: even with all three guards, if `aggPrimalType` still carries the pair type, the `emitDAddOfDiffInstType` dispatch still picks `DiffPair.dadd` and reinstates the malformed IR one layer up. A fourth narrowing of `aggregatePrimalType` to `loadPairType->getValueType()` at the transposeLoad site is required ([slang autodiff transpose: narrowing the gradient at construction is not enough — the aggregation type drives dadd dispatch, and even all four narrowings may be insufficient](wiki/learnings/1779432820940-slang-autodiff-transpose-aggregation-type-vs-gradi.md)). Even then, when the malformed pattern is `MakeDiffPair(<add>, <add>)` with `GetPrimal/GetDifferential` of `get_field(..., %differential)` chains, the synthesizer is the inlined `dadd` of a `DiffPair` arriving from a dispatch site outside the three patched locations — all `emitDAddOfDiffInstType` call sites need parallel narrowing.

The best diagnostic shortcut: a one-shot `fprintf` in `emitFieldAccessor`'s `else { SLANG_UNEXPECTED(...) }` branch dumping `baseInst` and the parent function pinpoints the exact moment the malformed IR appears, far faster than `-dump-ir-before/-after`. The regression source for #11160 was commit `45ccce9a3` (2026-04-01) — the autodiff transpose/`dadd` dispatch refactor.

## Derivative Variant Tracking: Use the Association API

When walking from a primary callee to its associated derivative variants in the differentiability checker, the correct API is `DifferentiableTypeConformanceContext::tryGetAssociationOfKind(func, AnnotationKind::ForwardDerivative)` (and `BackwardDerivativeApply`), **not** a raw iteration over `IRForwardDerivativeDecoration` / `IRBackwardDerivativeDecoration` ([slang autodiff: derivative variants are tracked via tryGetAssociationOfKind, not raw IR decoration ops](wiki/learnings/1780295760692-slang-autodiff-derivative-variants-are-tracked-via.md)). Raw decoration list iteration misses specialized/generic instantiations; the association API handles unwrapping correctly.

This matters for the derivative-primal capability propagation path as well: only the association registry (`getAssociatedDeclsForDecl`, filtering `DeclAssociationKind::{ForwardDerivativeFunc,BackwardDerivativeFunc}`) sees both FORWARD placement (`[ForwardDerivative(fn)]` on the primal) and INVERSE placement (`[ForwardDerivativeOf]` on the derivative). The inverse placement calls `registerAssociatedDecl` but never `addModifier` — so any pass that uses `getModifiersOfType<UserDefinedDerivativeAttribute>()` misses all inverse-placed derivatives ([slang autodiff: inverse-direction derivative placement registers an association, not a primal modifier — capability/propagation passes must consult getAssociatedDeclsForDecl](wiki/learnings/1781170088020-slang-autodiff-inverse-direction-derivative-placem.md)). A single grep (`grep -rn registerAssociatedDecl source/`) confirms that `registerAssociatedDecl` is called exactly once, in the inverse path; a unified association loop that relies on both placements registering is verified correct only via that grep ([Slang autodiff: gate derivative→primal capability propagation on explicit [require], and verify 'registers an association' claims](wiki/learnings/1781186036448-slang-autodiff-gate-derivative-primal-capability-p.md)).

## Member Method Handling: NoDiffThis vs. Default-Differentiable

PR #10827 added a `this`-type slot to four AST-level autodiff func-type resolvers (`BwdCallableFuncType`, `BwdDiffFuncType`, `RematFuncType`, `FwdDiffFuncType`) but not to `ApplyForBwdFuncType`, the IR-level translator (`slang-ir-autodiff-rev.cpp:712-857`), or front-end `InvokeExpr` lowering (`slang-lower-to-ir.cpp:4974`). The result: `__bwd_diff(obj.method)(args)` on a `[NoDiffThis]` non-static member segfaults on Release / asserts Debug ([slang autodiff: PR #10827 left BwdDiffFuncType/RematFuncType/BwdCallableFuncType/FwdDiffFuncType inconsistent with ApplyForBwdFuncType + IR-pass + front-end](wiki/learnings/1780050112745-slang-autodiff-pr-10827-left-bwddifffunctype-remat.md)).

The gate for the front-end auto-prepend fix is NOT `!hasModifier<HLSLStaticModifier>() && !as<ConstructorDecl>(callableDecl>` — that axis is wrong. The resolved derivative type only gets a separate `this` slot for `[NoDiffThis]` methods. For default-differentiable-`this` methods there is no extra `this` slot, so the wider gate incorrectly injects a surplus argument (type mismatch: `T` vs `inout DifferentialPair<T>`). The correct gate is `callableDecl->hasModifier<NoDiffThisAttribute>()` — note the class name is `NoDiffThisAttribute`, NOT `NoDiffThisModifier` ([slang-autodiff-11356-fix-axis-is-NoDiffThis-not-static-ctor](wiki/learnings/1780072266959-slang-autodiff-11356-fix-axis-is-nodiffthis-not-st.md)). Tests must also cover both `__bwd_diff` and `__fwd_diff` with a SPIR-V or WGSL target to exercise the original emit failure mode.

## Derivative Variant Purity Check: PreferRecompute

When extending the `isInstCarryingOverDiff` readNone carry-gate in `slang-ir-check-differentiability.cpp` to also require derivative variants to be side-effect free, the naive requirement `isReadNoneCallee(deriv)` produces false-positive E41031 on built-in math (`sqrt`, `max`, `dot`, `operator/`). Their derivatives in `diff.meta.slang` use `[PreferRecompute]`, not `[__readNone]`, and `checkAutoDiffUsages` runs before `propagateFuncProperties` (which would auto-mark them readNone) ([Slang autodiff: derivative-variant purity check must accept [PreferRecompute], not just [__readNone]](wiki/learnings/1780312221839-slang-autodiff-derivative-variant-purity-check-mus.md)).

The fix accepts both `isReadNoneCallee(deriv)` OR `IRPreferRecomputeDecoration` on the underlying `IRFunc`, but must:
1. Exclude `SideEffectBehavior.Allow` (operand 0 of `[PreferRecompute]`; only `Warn`=0 is a purity signal).
2. Recurse (not iterate) through wrappers: `IRTranslateBase` ops, `IRSpecialize`, `IRGeneric` → `findGenericReturnVal`, then check the `IRFunc`.

## Propagation Correctness: Gate on Explicit [require]

When propagating a derivative's capability requirements onto its primal (slang#11551), gating on `derivativeFuncDecl->findModifier<RequireCapabilityAttribute>()` is essential. Without it, `diff.meta.slang` attaches ~64 target-specialized derivative families to all-targets builtins (math intrinsics), and joining those bodies' `inferredCapabilityRequirements` onto the builtins aborts core-module compilation silently (`AbortCompilationException`, the core-module-compile sink has no writer) ([Slang autodiff: gate derivative→primal capability propagation on explicit [require], and verify 'registers an association' claims](wiki/learnings/1781186036448-slang-autodiff-gate-derivative-primal-capability-p.md)).

Pass ordering note: `ensureAllDeclsRec` advances ALL decls through each `DeclCheckState` globally, so `ReadyForLookup` (where the inverse association is registered) always completes before `CapabilityChecked` — the capability visitor needs no reordering.

## Sibling Operator Design Rule: Honor Existing Overrides

When designing a new autodiff operator (`value_and_bwd_diff`, `vjp_with_value`, etc.), it must compute the same gradient as its sibling and honor the same user override ([slang autodiff — sibling diff operators must honor the same user derivative override (correctness, not perf)](wiki/learnings/1780401329313-slang-autodiff-sibling-diff-operators-must-honor-t.md)). Auto-synthesizing while a sibling dispatches to a `[BackwardDerivative]` override causes:
1. Silent numerical divergence — the override may encode a numerically distinct formulation the user explicitly chose (e.g. `sqrt` near 0, log-sum-exp).
2. Outright breakage for mandatory-override functions — `bwd_diff(f)` can call functions with non-differentiable primitives only because an override exists; an auto-synthesizing sibling fails to compile for them.

The correct default for a value-surfacing operator is to **compose**: call `f` for the value + call the existing `[BackwardDerivative]` for the gradients. A dedicated `[ValueAndBackwardDerivativeOf]` attribute then becomes a pure performance optimization (fused value+gradient in one pass) rather than the only-correct path.

## Return Shape Rule: Fwd/Bwd Asymmetry

The rule for whether a new autodiff operator returns `DifferentialPair<R>` or bare `R` ([slang autodiff — return shape rule for new diff operators (fwd/bwd asymmetry)](wiki/learnings/1780285608597-slang-autodiff-return-shape-rule-for-new-diff-oper.md)): if the operator **produces** the differential of the return, use `DifferentialPair<R>`; if it **consumes** the differential of the return as an input, use bare `R`. Forward mode produces an output tangent (pair-wrapping is meaningful); backward mode receives a cotangent as input (pair-wrapping would put a meaningless value in `.d`). Cosmetic symmetry with the other-mode operator is not a sufficient reason to force pair-wrapping.

## Recursive Witness Table Walks: Cycle Guard Required

Any recursive walk over witness-table-valued entries in Slang IR must carry a visited-set / cycle guard, because Slang's autodiff `buildDifferentiablePairWitness` (`slang-ir-autodiff.cpp:491-494`) deliberately creates a self-referential witness-table entry — the table stores itself as the satisfying value for `differentialAssocTypeWitnessStructKey` ([Recursive witness-table walks need a cycle guard — autodiff creates self-referential witness tables](wiki/learnings/1780769202792-recursive-witness-table-walks-need-a-cycle-guard-a.md)). The premise "nested witness tables form an acyclic tree" is false in well-formed IR; any helper that recurses into `as<IRWitnessTable>(entry->getSatisfyingVal())` without a `HashSet<IRWitnessTable*>` visited set will stack-overflow the moment it encounters a missing key. The safe pattern (`_lookupWitness` at `slang-ir-autodiff.cpp:25-36`) searches direct entries only.

A second trap: recursing into arbitrary witness-table-valued entries also descends into associated-type conformance tables, not just base-interface inheritance entries — correctness rests on global key-uniqueness (one `IRStructKey` per requirement decl), which should be stated explicitly wherever the walk is defined.

**Source learnings (12):**
- [slang autodiff transpose: bare-diff gradient with DiffPair aggPrimalType causes crash](wiki/learnings/1779432739908-slang-autodiff-transpose-bare-diff-gradient-with-d.md)
- [slang autodiff transpose: aggregation type vs gradient narrowing — not enough with three sites](wiki/learnings/1779432820940-slang-autodiff-transpose-aggregation-type-vs-gradi.md)
- [slang propagateConstExpr's paramCount==callArgCount asserts BEFORE the autodiff pass](wiki/learnings/1779369269598-slang-propagateconstexpr-s-paramcount-callargcount.md)
- [slang autodiff: PR #10827 left BwdDiffFuncType/RematFuncType inconsistent](wiki/learnings/1780050112745-slang-autodiff-pr-10827-left-bwddifffunctype-remat.md)
- [slang autodiff #11356: fix axis is NoDiffThis not static/ctor](wiki/learnings/1780072266959-slang-autodiff-11356-fix-axis-is-nodiffthis-not-st.md)
- [slang autodiff: return shape rule for new diff operators (fwd/bwd asymmetry)](wiki/learnings/1780285608597-slang-autodiff-return-shape-rule-for-new-diff-oper.md)
- [slang autodiff: derivative variants are tracked via tryGetAssociationOfKind](wiki/learnings/1780295760692-slang-autodiff-derivative-variants-are-tracked-via.md)
- [Derivative-variant purity check must accept [PreferRecompute], not just [__readNone] (#11374)](wiki/learnings/1780312221839-slang-autodiff-derivative-variant-purity-check-mus.md)
- [slang autodiff: sibling diff operators must honor the same user derivative override](wiki/learnings/1780401329313-slang-autodiff-sibling-diff-operators-must-honor-t.md)
- [Recursive witness-table walks need a cycle guard — autodiff creates self-referential witness tables](wiki/learnings/1780769202792-recursive-witness-table-walks-need-a-cycle-guard-a.md)
- [slang autodiff: inverse-direction derivative placement registers an association, not a primal modifier](wiki/learnings/1781170088020-slang-autodiff-inverse-direction-derivative-placem.md)
- [slang autodiff: gate derivative→primal capability propagation on explicit [require]](wiki/learnings/1781186036448-slang-autodiff-gate-derivative-primal-capability-p.md)
_Catalog: [[wiki/index.md]]_
