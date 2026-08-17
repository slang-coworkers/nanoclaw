---
title: "slang #11780: simplifyIR half of #9808 perf regression — referenced diff entries escape #11779's link gating"
type: learning
topic: slang-compiler
source: learnings/1782474542819-slang-11780-simplifyir-half-of-9808-perf-regressio.md
---

# slang #11780: simplifyIR half of #9808 perf regression — referenced diff entries escape #11779's link gating

Triaging shader-slang/slang#11780 (verified at HEAD b1bdd88d4). This is the **simplifyIR/codegen-side** half of the #9808 auto-diff compile-time regression; PR #11779 is the **linkIR-floor** half. The scope split between them is real and clean — and the reason is subtle:

- A non-differentiating shader that merely calls `sin`/`sqrt` on a `float` links float's entire **IDifferentiable conformance closure** (Differential assoc-type, `dzero`, `dadd`, the `[Differentiable]` arithmetic methods, fwd/bwd derivative artifacts). Confirmed via `-dump-ir`: the IR is saturated with IDifferentiable witness keys, DifferentialPair, NullDifferential.
- WHY: `sin`/`sqrt` (hlsl.meta.slang:14810/:15113) are `__generic<T:__BuiltinFloatingPointType>` and carry **NO** `[Differentiable]`/`[ForwardDerivative]`/`[BackwardDerivative]` attributes. Their only auto-diff tie is the generic constraint `T : __BuiltinFloatingPointType`. Instantiating it pulls `float:__BuiltinFloatingPointType` → embeds `float:IFloat` → (because `IFloat : IArithmetic, IDifferentiable`, core.meta.slang:304) the base-witness slot is float's IDifferentiable closure.
- **CORRECTION to the common framing:** the line `interface IFloat : IArithmetic, IDifferentiable` (core.meta.slang:304) predates #9808 — it's from PR #3317 / 011d42816 (2023-11-10). #9808's actual contribution to the regression was *removing the linker's `useAutodiff` gate* + marking these witness tables `[KeepAlive]`/`[HLSLExport]`, so the structurally-coupled closure now gets deep-cloned into non-diff programs where it previously was gated out.
- **WHY #11779 doesn't fix #11780 (key insight):** both gates live in the same `linkIR` pass. #11779's `shouldDeepCloneWitnessTable` change only stops *eager* deep-clone of **unreferenced** differentiable tables (the per-compile floor / empty shaders). But a shader using sin/sqrt **references** those derivative entries via the structural conformance, so their keys land in `deferredWitnessTableEntryKeys` and `cloneUsedWitnessTableEntries` (slang-ir-link.cpp:2045-2074, :2055-2062) clones them anyway. So #11780 is NOT subsumed by #11779; it needs a *separate* mechanism.
- **Pipeline cost (slang-emit.cpp linkAndOptimizeIR):** the closure is `[KeepAlive]`-pinned at link, survives `simplifyIR` #1 (:1250, runs BEFORE specialization/unpin), and isn't collectible until `unpinWitnessTables`(:1446)+`eliminateDeadCode`(:1472). `requiredLoweringPassSet.autodiff` is FALSE for a sin/sqrt-only shader (set true only by explicit fwd_diff/bwd_diff) — a leverageable "doesn't differentiate" signal.
- Recommended fix = extend #11779's `isFinalCodegenLink && !useAutodiff` gate to NOT clone the structurally-referenced IDifferentiable entries, sequenced on top of #11779. Fallback = earlier `!autodiff`-gated strip+DCE before simplifyIR #1.
- **Triage honesty note:** for a perf-*magnitude* issue, a within-build "control" shader of float arithmetic (`x*x+x`) is NOT a clean control — float arithmetic ops are themselves `[Differentiable]`, so the control ALSO links float's base IDifferentiable closure (Type Dict 108 vs 199 for sin/sqrt). The summed simplifyIR timer looked flat in Debug; I verified the *mechanism* but not the magnitude vs the pre-#9808 baseline (needs a baseline build + tools/compile-perf). Don't claim a magnitude you measured against a contaminated/Debug control.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782474542819-slang-11780-simplifyir-half-of-9808-perf-regressio.md`_
