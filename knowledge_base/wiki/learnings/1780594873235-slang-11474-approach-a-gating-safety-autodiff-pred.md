---
title: "slang#11474 Approach A gating-safety: .autodiff predicate is narrower than finalizeAutoDiffPass strips"
type: learning
topic: slang-compiler
source: learnings/1780594873235-slang-11474-approach-a-gating-safety-autodiff-pred.md
---

# slang#11474 Approach A gating-safety: .autodiff predicate is narrower than finalizeAutoDiffPass strips

Investigating slang#11474 (compile-time regression, autodiff). Two non-obvious findings on the recommended Approach A (gate the unguarded `finalizeAutoDiffPass`/`lowerDiffTypeInfoInsts` at slang-emit.cpp:1286/1295 behind `requiredLoweringPassSet.autodiff`):

1. **The gate predicate is NARROWER than what the passes clean up.** `calcRequiredLoweringPassSet` (slang-emit.cpp:403-578) sets `.autodiff=true` ONLY for `IRTranslateBase`/`IRTranslatedTypeBase` and `kIROp_Forward/BackwardDifferentiate` ops. But `finalizeAutoDiffPass` (slang-ir-autodiff.cpp:1101-1127) ALSO strips DifferentialPairType, DetachDerivative, type annotations, noDiff attrs, autodiff *decorations* (which `[Differentiable]` functions carry even when never differentiated), and releases differentiable-interface keep-alives; and `lowerDiffTypeInfoInsts` lowers `DiffTypeInfo` (un-lowered → hard emit failure). So gating behind `.autodiff` is safe ONLY IF no `.autodiff==false` module ever carries those constructs into emit. That is an OPEN correctness question — settle it by running the autodiff+emit test suites WITH the gate (any new failure ⇒ use a broader "contains any autodiff construct" scan instead), or get autodiff-owner (saipraveenb25) sign-off. Don't ship the 1-line gate blind.

2. **The real fixed cost is partly the `AutoDiffSharedContext` ctor** (slang-ir-autodiff.cpp:196), constructed unconditionally inside finalize: it walks ALL global insts for KnownBuiltin interface types, and because the core module always links `IDifferentiable`, it then does interface-entry lookups + a `traverseUsers<IRWitnessTable>` on EVERY compile — autodiff-free or not. Consistent with precompilation:dxil +36%.

3. **Provenance caveat:** triage memos for this issue attribute the unguarded calls to commit `f6e4a0c51` — FALSE; that commit is "Reject pointer fields in dynamic dispatch for SPIRV (#10679)" and doesn't touch slang-emit.cpp. Verify cited commits; don't propagate.

Approach B (specialization fixpoint amplification, mono +16%/+35%) is owner-territory (saipraveenb25) — profile outer-iteration count vs derivative count first; synthesis itself is memoized (slang-ir-translate.cpp:39-53), the cost is extra fixpoint iterations. Full plan: /workspace/agent/reports/slang-11474.md.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1780594873235-slang-11474-approach-a-gating-safety-autodiff-pred.md`_
