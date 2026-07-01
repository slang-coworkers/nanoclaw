---
title: "Slang Autodiff & Differentiation: Internals, Bugs, and Design Rules"
type: concept
group: slang-autodiff-ir
tags: [autodiff, differentiation, transpose, derivative-variants, purity, capability, member-methods, performance, witness-tables]
source_count: 21
---

# Slang Autodiff & Differentiation: Internals, Bugs, and Design Rules

Slang's automatic differentiation (autodiff) system is one of the most complex subsystems in the compiler. This page collects hard-won knowledge about its internal invariants, recurring bug patterns, and design rules for extending it — covering the transpose pass, derivative variant tracking, member-method handling, performance regressions, and operator design.

## Transpose Pass and Gradient Type Mismatches

The transpose pass (`source/slang/slang-ir-autodiff-transpose.cpp`) is a common site for subtle type mismatches when extracting differential fields from `DiffPair`-typed values.

When `transposeLoad` extracts the differential field of a pair-typed loaded value to make gradients bare-diff, the `aggPrimalType` passed to `emitAggregateValue` must also be narrowed to the pair's inner primal type — otherwise `emitDAddOfDiffInstType` dispatches via `DiffPair.dadd`, whose inlined body applies pair-typed accessors (`GetPrimal`/`GetDifferential`) to bare-diff arguments and crashes with `"Unrecognized field. Cannot emit field accessor"` ([[wiki/learnings/1779432739908-slang-autodiff-transpose-bare-diff-gradient-with-d.md]]).

Three-site narrowing (transposeMakePair ~line 1700, materializeDifferentialPairGetElementGradients ~line 2660, transposeLoad ~line 1611) is **necessary but not sufficient**: even with all three guards, if `aggPrimalType` still carries the pair type, the `emitDAddOfDiffInstType` dispatch still picks `DiffPair.dadd` and reinstates the malformed IR one layer up. A fourth narrowing of `aggregatePrimalType` to `loadPairType->getValueType()` at the transposeLoad site is required ([[wiki/learnings/1779432820940-slang-autodiff-transpose-aggregation-type-vs-gradi.md]]). Even then, when the malformed pattern is `MakeDiffPair(<add>, <add>)` with `GetPrimal/GetDifferential` of `get_field(..., %differential)` chains, the synthesizer is the inlined `dadd` of a `DiffPair` arriving from a dispatch site outside the three patched locations — all `emitDAddOfDiffInstType` call sites need parallel narrowing.

The best diagnostic shortcut: a one-shot `fprintf` in `emitFieldAccessor`'s `else { SLANG_UNEXPECTED(...) }` branch dumping `baseInst` and the parent function pinpoints the exact moment the malformed IR appears, far faster than `-dump-ir-before/-after`. The regression source for #11160 was commit `45ccce9a3` (2026-04-01) — the autodiff transpose/`dadd` dispatch refactor.

## Derivative Variant Tracking: Use the Association API

When walking from a primary callee to its associated derivative variants in the differentiability checker, the correct API is `DifferentiableTypeConformanceContext::tryGetAssociationOfKind(func, AnnotationKind::ForwardDerivative)` (and `BackwardDerivativeApply`), **not** a raw iteration over `IRForwardDerivativeDecoration` / `IRBackwardDerivativeDecoration` ([[wiki/learnings/1780295760692-slang-autodiff-derivative-variants-are-tracked-via.md]]). Raw decoration list iteration misses specialized/generic instantiations; the association API handles unwrapping correctly.

This matters for the derivative-primal capability propagation path as well: only the association registry (`getAssociatedDeclsForDecl`, filtering `DeclAssociationKind::{ForwardDerivativeFunc,BackwardDerivativeFunc}`) sees both FORWARD placement (`[ForwardDerivative(fn)]` on the primal) and INVERSE placement (`[ForwardDerivativeOf]` on the derivative). The inverse placement calls `registerAssociatedDecl` but never `addModifier` — so any pass that uses `getModifiersOfType<UserDefinedDerivativeAttribute>()` misses all inverse-placed derivatives ([[wiki/learnings/1781170088020-slang-autodiff-inverse-direction-derivative-placem.md]]). A single grep (`grep -rn registerAssociatedDecl source/`) confirms that `registerAssociatedDecl` is called exactly once, in the inverse path; a unified association loop that relies on both placements registering is verified correct only via that grep ([[wiki/learnings/1781186036448-slang-autodiff-gate-derivative-primal-capability-p.md]]).

## Member Method Handling: NoDiffThis vs. Default-Differentiable

PR #10827 added a `this`-type slot to four AST-level autodiff func-type resolvers (`BwdCallableFuncType`, `BwdDiffFuncType`, `RematFuncType`, `FwdDiffFuncType`) but not to `ApplyForBwdFuncType`, the IR-level translator (`slang-ir-autodiff-rev.cpp:712-857`), or front-end `InvokeExpr` lowering (`slang-lower-to-ir.cpp:4974`). The result: `__bwd_diff(obj.method)(args)` on a `[NoDiffThis]` non-static member segfaults on Release / asserts Debug ([[wiki/learnings/1780050112745-slang-autodiff-pr-10827-left-bwddifffunctype-remat.md]]).

The gate for the front-end auto-prepend fix is NOT `!hasModifier<HLSLStaticModifier>() && !as<ConstructorDecl>(callableDecl>` — that axis is wrong. The resolved derivative type only gets a separate `this` slot for `[NoDiffThis]` methods. For default-differentiable-`this` methods there is no extra `this` slot, so the wider gate incorrectly injects a surplus argument (type mismatch: `T` vs `inout DifferentialPair<T>`). The correct gate is `callableDecl->hasModifier<NoDiffThisAttribute>()` — note the class name is `NoDiffThisAttribute`, NOT `NoDiffThisModifier` ([[wiki/learnings/1780072266959-slang-autodiff-11356-fix-axis-is-nodiffthis-not-st.md]]). Tests must also cover both `__bwd_diff` and `__fwd_diff` with a SPIR-V or WGSL target to exercise the original emit failure mode.

## Derivative Variant Purity Check: PreferRecompute

When extending the `isInstCarryingOverDiff` readNone carry-gate in `slang-ir-check-differentiability.cpp` to also require derivative variants to be side-effect free, the naive requirement `isReadNoneCallee(deriv)` produces false-positive E41031 on built-in math (`sqrt`, `max`, `dot`, `operator/`). Their derivatives in `diff.meta.slang` use `[PreferRecompute]`, not `[__readNone]`, and `checkAutoDiffUsages` runs before `propagateFuncProperties` (which would auto-mark them readNone) ([[wiki/learnings/1780312221839-slang-autodiff-derivative-variant-purity-check-mus.md]]).

The fix accepts both `isReadNoneCallee(deriv)` OR `IRPreferRecomputeDecoration` on the underlying `IRFunc`, but must:
1. Exclude `SideEffectBehavior.Allow` (operand 0 of `[PreferRecompute]`; only `Warn`=0 is a purity signal).
2. Recurse (not iterate) through wrappers: `IRTranslateBase` ops, `IRSpecialize`, `IRGeneric` → `findGenericReturnVal`, then check the `IRFunc`.

## Propagation Correctness: Gate on Explicit [require]

When propagating a derivative's capability requirements onto its primal (slang#11551), gating on `derivativeFuncDecl->findModifier<RequireCapabilityAttribute>()` is essential. Without it, `diff.meta.slang` attaches ~64 target-specialized derivative families to all-targets builtins (math intrinsics), and joining those bodies' `inferredCapabilityRequirements` onto the builtins aborts core-module compilation silently (`AbortCompilationException`, the core-module-compile sink has no writer) ([[wiki/learnings/1781186036448-slang-autodiff-gate-derivative-primal-capability-p.md]]).

Pass ordering note: `ensureAllDeclsRec` advances ALL decls through each `DeclCheckState` globally, so `ReadyForLookup` (where the inverse association is registered) always completes before `CapabilityChecked` — the capability visitor needs no reordering.

## Sibling Operator Design Rule: Honor Existing Overrides

When designing a new autodiff operator (`value_and_bwd_diff`, `vjp_with_value`, etc.), it must compute the same gradient as its sibling and honor the same user override ([[wiki/learnings/1780401329313-slang-autodiff-sibling-diff-operators-must-honor-t.md]]). Auto-synthesizing while a sibling dispatches to a `[BackwardDerivative]` override causes:
1. Silent numerical divergence — the override may encode a numerically distinct formulation the user explicitly chose (e.g. `sqrt` near 0, log-sum-exp).
2. Outright breakage for mandatory-override functions — `bwd_diff(f)` can call functions with non-differentiable primitives only because an override exists; an auto-synthesizing sibling fails to compile for them.

The correct default for a value-surfacing operator is to **compose**: call `f` for the value + call the existing `[BackwardDerivative]` for the gradients. A dedicated `[ValueAndBackwardDerivativeOf]` attribute then becomes a pure performance optimization (fused value+gradient in one pass) rather than the only-correct path.

## Return Shape Rule: Fwd/Bwd Asymmetry

The rule for whether a new autodiff operator returns `DifferentialPair<R>` or bare `R` ([[wiki/learnings/1780285608597-slang-autodiff-return-shape-rule-for-new-diff-oper.md]]): if the operator **produces** the differential of the return, use `DifferentialPair<R>`; if it **consumes** the differential of the return as an input, use bare `R`. Forward mode produces an output tangent (pair-wrapping is meaningful); backward mode receives a cotangent as input (pair-wrapping would put a meaningless value in `.d`). Cosmetic symmetry with the other-mode operator is not a sufficient reason to force pair-wrapping.

## Recursive Witness Table Walks: Cycle Guard Required

Any recursive walk over witness-table-valued entries in Slang IR must carry a visited-set / cycle guard, because Slang's autodiff `buildDifferentiablePairWitness` (`slang-ir-autodiff.cpp:491-494`) deliberately creates a self-referential witness-table entry — the table stores itself as the satisfying value for `differentialAssocTypeWitnessStructKey` ([[wiki/learnings/1780769202792-recursive-witness-table-walks-need-a-cycle-guard-a.md]]). The premise "nested witness tables form an acyclic tree" is false in well-formed IR; any helper that recurses into `as<IRWitnessTable>(entry->getSatisfyingVal())` without a `HashSet<IRWitnessTable*>` visited set will stack-overflow the moment it encounters a missing key. The safe pattern (`_lookupWitness` at `slang-ir-autodiff.cpp:25-36`) searches direct entries only.

A second trap: recursing into arbitrary witness-table-valued entries also descends into associated-type conformance tables, not just base-interface inheritance entries — correctness rests on global key-uniqueness (one `IRStructKey` per requirement decl), which should be stated explicitly wherever the walk is defined.

## Performance: Unconditional Autodiff Passes (#9808 Regression)

Two distinct performance root causes from the #9808 autodiff refactor ([[wiki/learnings/1780594441175-slang-autodiff-9808-leaks-compile-time-onto-non-au.md]]):

1. **Unconditional whole-module finalization:** `finalizeAutoDiffPass` (~slang-emit.cpp:1286) and `lowerDiffTypeInfoInsts` (~:1295) run unconditionally, while `checkAutodiffPatterns` (~:1243) is correctly guarded by `if (requiredLoweringPassSet.autodiff)`. The `AutoDiffSharedContext` constructor (`slang-ir-autodiff.cpp:196`) walks ALL global insts for KnownBuiltin interface types unconditionally, which is expensive because the core module always links `IDifferentiable`. Gating both passes behind `.autodiff` is a candidate fix, but requires verifying that no `.autodiff==false` module carries `DiffTypeInfo` or autodiff decorations into emit.

2. **Specialization fixpoint amplification:** demand-driven derivative synthesis inside `specializeDynamicInsts` (slang-ir-specialize.cpp:1779) injects derivatives inside the whole-module fixpoint `for(;;)` @1680; each injection sets `iterChanged`, triggering another full outer iteration re-running 5 heavyweight passes. Synthesis itself is memoized (slang-ir-translate.cpp:39-53); the cost is the extra fixpoint iterations.

The gating predicate is narrower than what the passes clean up ([[wiki/learnings/1780594873235-slang-11474-approach-a-gating-safety-autodiff-pred.md]]): `calcRequiredLoweringPassSet` sets `.autodiff=true` only for `IRTranslateBase`/`IRTranslatedTypeBase` and `kIROp_Forward/BackwardDifferentiate` ops, but `finalizeAutoDiffPass` also strips `DifferentialPairType`, `DetachDerivative`, autodiff decorations (which `[Differentiable]` functions carry even when never differentiated), and releases differentiable-interface keep-alives.

The `simplifyIR`-side half of the regression is distinct ([[wiki/learnings/1782474542819-slang-11780-simplifyir-half-of-9808-perf-regressio.md]]): a shader that merely calls `sin`/`sqrt` on a `float` links float's entire `IDifferentiable` conformance closure (via `IFloat : IArithmetic, IDifferentiable`, core.meta.slang:304). #9808 removed the linker's `useAutodiff` gate and marked the witness tables `[KeepAlive]`/`[HLSLExport]`, so the closure now deep-clones into non-diff programs. PR #11779 (linkIR floor fix) doesn't subsume this: it only stops eager deep-clone of **unreferenced** tables; a shader using `sin/sqrt` **references** those derivative entries via structural conformance and gets cloned anyway.

## Conditional Type Differentiation: Missing Conditional Intrinsics

`bwd_diff` of a `[Differentiable]` function calling `Conditional<T,b>.get()` aborts with `internal error[E99999]` even with a concrete literal flag ([[wiki/learnings/1782490233144-slang-autodiff-wires-optional-intrinsics-but-omits.md]]). The forward transcriber `translateInstImpl` handles the Optional family (`GetOptionalValue`, `MakeOptionalValue`, etc.) but has zero cases for `kIROp_GetConditionalValue`/`MakeConditionalValue` — the structural sibling Conditional. Fix: mirror Optional handling across fwd/transpose/primal-hoist, plus ConditionalType diff in `differentiateType` only when a differentiated Conditional flows through.

Important: `bwd_diff` builds the forward-diff function **first** then transposes, so a backward-mode ICE can fire in the forward transcriber. The user-facing caret pointing at `.get()` confirms this (the forward `InternalCompilerError{.location=origInst->sourceLoc}` carries a source loc; the transpose default `SLANG_UNEXPECTED` does not).

The ICE for `Conditional` differentiation is separate from the `Conditional`/`makeConditionalValue` spirv-emit crash in #11782, which is a distinct intrinsic at a distinct site ([[wiki/learnings/1782488412008-slang-11782-conditional-autodiff-crash-is-flag-ind.md]]).

## ByteAddressBuffer Alignment Diagnostic Interactions

For the `LoadAligned<T>` constexpr alignment decomposition (slang#11545), `simplifyIR` runs before `legalizeByteAddressBufferOps` and folds `kIROp_GetNaturalStride` to a literal. So at the legalize entry point, an implicit single-arg `LoadAligned<float3>(16)` has its alignment as a folded `IRIntLit` — indistinguishable from an explicit user promise ([[wiki/learnings/1781318517600-slang-11590-41303-can-t-live-in-validation-only-sl.md]]). Diagnostic 41302 ("alignment must be compile-time constant") is slice-1-safe since the folded literal passes; diagnostic 41303 ("const location multiple of alignment") is NOT slice-1-safe because `float3`'s natural stride (12) differs from its true natural alignment (4), causing false rejection of valid `LoadAligned<float3>(16)` (16%12≠0).

The merged Slice-1 PR #11594 implemented the constexpr parameter contract but added no 41303 IR-pass check ([[wiki/learnings/1781770372055-slang-11545-byte-address-slice-1-11594-delivered-4.md]]). A dependent slice claiming "validated by #11594's 41303" is incorrect — verify actual merged diagnostics before treating a sibling slice as unblocked.

## Autodiff Test Conventions

Tests for diagnostics emitted by `slang-ir-check-differentiability` use `//TEST:SIMPLE(filecheck=CHECK):` with `-target hlsl -stage compute -entry main`, matching the convention of existing tests like #11286 — NOT `//DIAGNOSTIC_TEST:SIMPLE(diag=CHECK):` ([[wiki/learnings/1780300985125-slang-autodiff-missing-no-diff-diagnostic-tests-us.md]]). Follow the in-tree neighbor convention; the general-case directive is documented but diverges from the established autodiff-test pattern.

## IR Classifier / Analysis Changes: Gate on Full-Suite CI

For IR-level classifier or lowering changes, do NOT declare a fix verified on a narrow test sweep (e.g. `tests/diagnostics/` only) ([[wiki/learnings/1782450782359-gate-slang-ir-classifier-fix-verdicts-on-full-suit.md]]). A classifier broadening that passes a 601-test `diagnostics/` sweep and earns a peer APPROVE can still produce false positives caught only in `tests/bugs/`. The specific example: classifying a store's value operand as a *read* spuriously emitted E41016 for `self.self = &self;` (storing an address is not reading the pointed-to location). Holding fixer PRs as drafts pending full-suite CI is what makes early catches possible.

## Derivative [require] must ride the differentiation use, not the primal

Follow-up to the "gate derivative→primal capability propagation on explicit `[require]`" learning: that gate (presence of `[require]`) was correct, but #11859 shows the *placement* is wrong. The derivative's `[require]` capability must ride the **differentiation use**, not be propagated onto the primal function — over-propagating to the primal makes non-AD callers of the primal inherit a capability they never asked for (an over-propagation regression) ([[wiki/learnings/1782864820466-slang-autodiff-derivative-require-must-ride-the-di.md]]).

But the *layer* the use-site hook lives at has a soundness gap. Reviewing PR #11872 (the #11859 fix) surfaced that Slang capability checking is **AST-only** — the synthesized IR derivative is never capability-checked (`grep -rlnE "[Cc]apabilit" source/slang/slang-ir-autodiff*.cpp` is empty; `slang-ir-late-require-capability.cpp` only handles explicit `__requireCapability`). So a `CapabilityDeclReferenceVisitor` use-site hook that fires only on a *direct* syntactic `fwd_diff(p)`/`bwd_diff(p)` cannot see **transitive** differentiation: `bwd_diff(g)` where `g` calls a `testC` carrying a `[require(spirv)]` user-defined derivative never joins `testCBwd`'s requirement — a silent false-negative that compiles clean on `-target hlsl`. The OLD primal-side model caught this for free because the requirement sat on `testC` and rode ordinary call-graph capability inference (`visitReferencedDecls` → `inferredCapabilityRequirements`), which is exactly what handles transitivity; an AST syntactic hook only sees the *outermost* operator. Reviewer rule: when a capability/requirement moves from a callee/primal to a "use-site," ask whether the old location rode call-graph inference and whether the new hook does. Note also DeepWiki claimed transitive propagation works and the IR derivative is capability-checked — it conflated *differentiability* checking (`CheckDifferentiabilityPassContext`) with *capability* checking (`SemanticsDeclCapabilityVisitor` / E36107); verify pipeline claims against source ([[wiki/learnings/1782882850345-slang-use-site-propagation-of-user-defined-derivat.md]]).

---
**Source learnings (23):**
- [[wiki/learnings/1779432739908-slang-autodiff-transpose-bare-diff-gradient-with-d.md]] — slang autodiff transpose: bare-diff gradient with DiffPair aggPrimalType causes crash
- [[wiki/learnings/1779432820940-slang-autodiff-transpose-aggregation-type-vs-gradi.md]] — slang autodiff transpose: aggregation type vs gradient narrowing — not enough with three sites
- [[wiki/learnings/1780050112745-slang-autodiff-pr-10827-left-bwddifffunctype-remat.md]] — slang autodiff: PR #10827 left BwdDiffFuncType/RematFuncType inconsistent
- [[wiki/learnings/1780072266959-slang-autodiff-11356-fix-axis-is-nodiffthis-not-st.md]] — slang autodiff #11356: fix axis is NoDiffThis not static/ctor
- [[wiki/learnings/1780285608597-slang-autodiff-return-shape-rule-for-new-diff-oper.md]] — slang autodiff: return shape rule for new diff operators (fwd/bwd asymmetry)
- [[wiki/learnings/1780295760692-slang-autodiff-derivative-variants-are-tracked-via.md]] — slang autodiff: derivative variants are tracked via tryGetAssociationOfKind
- [[wiki/learnings/1780300985125-slang-autodiff-missing-no-diff-diagnostic-tests-us.md]] — slang autodiff: missing no_diff diagnostic tests use //TEST:SIMPLE
- [[wiki/learnings/1780312221839-slang-autodiff-derivative-variant-purity-check-mus.md]] — slang autodiff: derivative variant purity check must accept [PreferRecompute]
- [[wiki/learnings/1780401329313-slang-autodiff-sibling-diff-operators-must-honor-t.md]] — slang autodiff: sibling diff operators must honor the same user derivative override
- [[wiki/learnings/1780594441175-slang-autodiff-9808-leaks-compile-time-onto-non-au.md]] — slang autodiff #9808 leaks compile-time onto non-autodiff modules via unconditional finalize passes
- [[wiki/learnings/1780594873235-slang-11474-approach-a-gating-safety-autodiff-pred.md]] — slang #11474: gating safety — .autodiff predicate is narrower than finalizeAutoDiffPass strips
- [[wiki/learnings/1780769202792-recursive-witness-table-walks-need-a-cycle-guard-a.md]] — Recursive witness-table walks need a cycle guard — autodiff creates self-referential witness tables
- [[wiki/learnings/1781170088020-slang-autodiff-inverse-direction-derivative-placem.md]] — slang autodiff: inverse-direction derivative placement registers an association, not a primal modifier
- [[wiki/learnings/1781186036448-slang-autodiff-gate-derivative-primal-capability-p.md]] — slang autodiff: gate derivative→primal capability propagation on explicit [require]
- [[wiki/learnings/1781318517600-slang-11590-41303-can-t-live-in-validation-only-sl.md]] — slang #11590: 41303 can't live in validation-only slice-1
- [[wiki/learnings/1781770372055-slang-11545-byte-address-slice-1-11594-delivered-4.md]] — slang #11545: byte-address slice-1 #11594 delivered 41302 but NOT 41303
- [[wiki/learnings/1782450782359-gate-slang-ir-classifier-fix-verdicts-on-full-suit.md]] — Gate Slang IR classifier fix verdicts on full-suite CI
- [[wiki/learnings/1782474542819-slang-11780-simplifyir-half-of-9808-perf-regressio.md]] — slang #11780: simplifyIR half of #9808 perf regression
- [[wiki/learnings/1782488412008-slang-11782-conditional-autodiff-crash-is-flag-ind.md]] — slang #11782: conditional autodiff crash is flag-independent
- [[wiki/learnings/1782490233144-slang-autodiff-wires-optional-intrinsics-but-omits.md]] — slang autodiff wires Optional intrinsics but omits the parallel Conditional family
- [[wiki/learnings/1779369269598-slang-propagateconstexpr-s-paramcount-callargcount.md]] — slang propagateConstExpr's paramCount==callArgCount asserts BEFORE the autodiff pass

- [[wiki/learnings/1782864820466-slang-autodiff-derivative-require-must-ride-the-di.md]] — Autodiff: derivative [require] must ride the differentiation use, not the primal (over-propagation #11859)
- [[wiki/learnings/1782882850345-slang-use-site-propagation-of-user-defined-derivat.md]] — Use-site [require] propagation is AST-only, so misses transitive differentiation (#11872 review gap)
_Catalog: [[wiki/index.md]]_
