---
title: "Slang Autodiff: Performance Regressions and IR-Pass Verification"
type: concept
group: slang-autodiff-ir
tags: [autodiff, differentiation, performance, passes, simplify-ir, ci-gating, verification]
source_count: 4
---

# Slang Autodiff: Performance Regressions and IR-Pass Verification

Companion to [[wiki/concepts/slang-autodiff-ir-autodiff-differentiation.md]] (internals and design rules). This page collects the compile-time regressions the #9808 autodiff refactor leaked onto non-autodiff modules — the unconditional finalization passes, the gating-safety caveat, and the distinct `simplifyIR` half — plus the CI-gating rule for IR classifier/analysis changes.

## TL;DR

- **#9808 leaked compile-time onto non-autodiff modules two ways.** (1) `finalizeAutoDiffPass` + `lowerDiffTypeInfoInsts` run unconditionally (unlike `checkAutodiffPatterns`, which is guarded by `.autodiff`), and the `AutoDiffSharedContext` constructor walks ALL global insts for KnownBuiltin interface types unconditionally — expensive because the core module always links `IDifferentiable`. (2) Demand-driven derivative synthesis inside the whole-module specialization fixpoint sets `iterChanged` per injection, re-running 5 heavyweight passes each outer iteration.
- **Gating fix caveat:** the `.autodiff` predicate is NARROWER than what `finalizeAutoDiffPass` actually strips. `calcRequiredLoweringPassSet` sets `.autodiff=true` only for translate ops and `kIROp_Forward/BackwardDifferentiate`, but the pass also strips `DifferentialPairType`, `DetachDerivative`, and autodiff decorations that plain `[Differentiable]` functions carry even when never differentiated. Verify no `.autodiff==false` module carries `DiffTypeInfo`/autodiff decorations into emit before gating.
- **The `simplifyIR` half (#11780) is distinct.** A shader merely calling `sin`/`sqrt` on a `float` links float's entire `IDifferentiable` conformance closure (via `IFloat : IArithmetic, IDifferentiable`). #9808 removed the linker's `useAutodiff` gate and marked those witness tables `[KeepAlive]`/`[HLSLExport]`. #11779's link-floor fix does NOT subsume it — it only stops eager deep-clone of UNREFERENCED tables; a `sin`/`sqrt` shader REFERENCES those derivative entries via structural conformance and gets cloned anyway.
- **Do NOT declare an IR-classifier fix verified on a narrow sweep** (e.g. `tests/diagnostics/` only). A broadening that passes a 601-test diagnostics sweep and earns a peer APPROVE can still false-positive in `tests/bugs/`. Hold fixer PRs as drafts pending full-suite CI — that discipline is what makes early catches possible.

## Performance: Unconditional Autodiff Passes (#9808 Regression)

Two distinct performance root causes emerge from the #9808 autodiff refactor ([slang autodiff #9808 leaks compile-time onto non-autodiff modules via unconditional finalize passes](../learnings/1780594441175-slang-autodiff-9808-leaks-compile-time-onto-non-au.md)):

1. **Unconditional whole-module finalization.** `finalizeAutoDiffPass` (~`slang-emit.cpp:1286`) and `lowerDiffTypeInfoInsts` (~`:1295`) run unconditionally, while `checkAutodiffPatterns` (~`:1243`) is correctly guarded by `if (requiredLoweringPassSet.autodiff)`. The `AutoDiffSharedContext` constructor (`slang-ir-autodiff.cpp:196`) walks ALL global insts for KnownBuiltin interface types unconditionally, which is expensive because the core module always links `IDifferentiable`. Gating both passes behind `.autodiff` is a candidate fix, but requires verifying that no `.autodiff==false` module carries `DiffTypeInfo` or autodiff decorations into emit.

2. **Specialization fixpoint amplification.** Demand-driven derivative synthesis inside `specializeDynamicInsts` (`slang-ir-specialize.cpp:1779`) injects derivatives inside the whole-module fixpoint `for(;;)` @1680; each injection sets `iterChanged`, triggering another full outer iteration re-running 5 heavyweight passes. Synthesis itself is memoized (`slang-ir-translate.cpp:39-53`); the cost is the extra fixpoint iterations, not re-synthesis.

### Gating safety: the `.autodiff` predicate is narrower than the passes clean up

The gating predicate is narrower than what the passes actually clean up ([slang#11474 Approach A gating-safety: .autodiff predicate is narrower than finalizeAutoDiffPass strips](../learnings/1780594873235-slang-11474-approach-a-gating-safety-autodiff-pred.md)): `calcRequiredLoweringPassSet` sets `.autodiff=true` only for `IRTranslateBase`/`IRTranslatedTypeBase` and `kIROp_Forward/BackwardDifferentiate` ops, but `finalizeAutoDiffPass` also strips `DifferentialPairType`, `DetachDerivative`, autodiff decorations (which `[Differentiable]` functions carry even when never differentiated), and releases differentiable-interface keep-alives. So a naive gating on `.autodiff` risks leaving those artifacts in a module the predicate classifies as non-autodiff — verify emit stays clean before shipping the gate.

### The `simplifyIR` half of the regression is distinct (#11780)

The `simplifyIR`-side half of the regression is separate from the finalize-pass gating ([slang #11780: simplifyIR half of #9808 perf regression — referenced diff entries escape #11779's link gating](../learnings/1782474542819-slang-11780-simplifyir-half-of-9808-perf-regressio.md)): a shader that merely calls `sin`/`sqrt` on a `float` links float's entire `IDifferentiable` conformance closure (via `IFloat : IArithmetic, IDifferentiable`, `core.meta.slang:304`). #9808 removed the linker's `useAutodiff` gate and marked the witness tables `[KeepAlive]`/`[HLSLExport]`, so the closure now deep-clones into non-diff programs. PR #11779 (linkIR floor fix) doesn't subsume this: it only stops eager deep-clone of **unreferenced** tables; a shader using `sin`/`sqrt` **references** those derivative entries via structural conformance and gets cloned anyway. Treat the two halves as independent fixes.

## IR Classifier / Analysis Changes: Gate on Full-Suite CI

For IR-level classifier or lowering changes, do NOT declare a fix verified on a narrow test sweep (e.g. `tests/diagnostics/` only) ([Gate Slang IR/classifier fix verdicts on full-suite CI](../learnings/1782450782359-gate-slang-ir-classifier-fix-verdicts-on-full-suit.md)). A classifier broadening that passes a 601-test `diagnostics/` sweep and earns a peer APPROVE can still produce false positives caught only in `tests/bugs/`. The specific example: classifying a store's value operand as a *read* spuriously emitted E41016 for `self.self = &self;` (storing an address is not reading the pointed-to location). Holding fixer PRs as drafts pending full-suite CI is what makes early catches possible.

---
**Source learnings (4):**
- [slang autodiff #9808 leaks compile-time onto non-autodiff modules via unconditional finalize passes](../learnings/1780594441175-slang-autodiff-9808-leaks-compile-time-onto-non-au.md)
- [slang #11474: gating safety — .autodiff predicate is narrower than finalizeAutoDiffPass strips](../learnings/1780594873235-slang-11474-approach-a-gating-safety-autodiff-pred.md)
- [slang #11780: simplifyIR half of #9808 perf regression](../learnings/1782474542819-slang-11780-simplifyir-half-of-9808-perf-regressio.md)
- [Gate Slang IR classifier fix verdicts on full-suite CI](../learnings/1782450782359-gate-slang-ir-classifier-fix-verdicts-on-full-suit.md)
_Catalog: [[wiki/index.md]]_
