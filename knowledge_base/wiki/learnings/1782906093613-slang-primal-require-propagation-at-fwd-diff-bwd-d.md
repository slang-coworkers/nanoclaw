---
title: "Slang primal [require] propagation at fwd_diff/bwd_diff is inconsistent across 4 cells (not a uniform gap)"
type: learning
topic: slang-compiler
source: learnings/1782906093613-slang-primal-require-propagation-at-fwd-diff-bwd-d.md
---

# Slang primal [require] propagation at fwd_diff/bwd_diff is inconsistent across 4 cells (not a uniform gap)

Context: triaging shader-slang/slang#11882 at HEAD 7f79b923f — "a primal's own `[require]` is dropped at a fwd_diff/bwd_diff use-site." The issue (bot-authored, split from #11872 review) claimed BOTH directions drop it, root-caused to the `visitMemberExpr` (traverses `baseExpression`) vs `visitStaticMemberExpr` (does not) asymmetry in the base `SemanticsDeclReferenceVisitor` (source/slang/slang-check-decl.cpp:1157-1166).

FINDING (empirically verified, CPU/`-target hlsl`, no GPU): propagation of a primal's OWN `[require(spirv)]` to a differentiation entry point is INCONSISTENT and depends on BOTH direction AND derivative kind:
- user-defined derivative ([ForwardDerivative]/[BackwardDerivative]): fwd_diff PROPAGATES (E36107), bwd_diff DROPPED.
- synthesized derivative ([Differentiable]): fwd_diff DROPPED, bwd_diff PROPAGATES.
- plain call foo(2.0): PROPAGATES (control).
So 2 of 4 (direction × user/synth) cells leak, 2 propagate.

WHY the single stated root cause is INCOMPLETE: both fwd_diff and bwd_diff go through the SAME rewrite (convertHigherOrderExprToLookup, slang-check-expr.cpp:4408-4410, `as<DifferentiateExpr>` matches both) into a lookup member expr. If the asymmetry were the sole cause, all 4 cells would behave identically. The base visitor ALSO has visitHigherOrderInvokeExpr (slang-check-decl.cpp:1230-1233) which DOES dispatch `baseFunction` (the primal); and ConstructDeclRefExpr (slang-check-expr.cpp:443) yields a StaticMemberExpr (base dropped, :489/:515) OR a plain MemberExpr (base traversed, :529) depending on the member's static-ness. Which form each cell lands in decides whether the primal is visited.

LESSON: when a bug report gives a clean single root cause for "X is dropped," run the full behavior matrix (direction × derivative-kind × call-form) before accepting it. A shared rewrite path that produces divergent results across variants means the stated cause is incomplete — there's additional path-dependent behavior. This also surfaced a genuine SEMANTIC design question (should a primal's own [require] gate fwd_diff/bwd_diff when a USER-DEFINED derivative means the primal body may never run?), making it a maintainer call (@expipiplus1, owner of the #11859/#11872 use-site rework), not a mechanical visitor patch. Disposition: HOLD for maintainer; do not auto-dispatch a fixer for capability-propagation changes with a known over-propagation abort history (#11551).

TRAP: local slangc rebuild failed on overlay-disk exhaustion (/ at 100%); but the pre-built Debug binary was built 17 min AFTER HEAD landed and both relevant .cpp files predate it, so repro was still HEAD-verified without a rebuild — check binary-build-time vs HEAD-commit-time and file mtimes before assuming you need to rebuild.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782906093613-slang-primal-require-propagation-at-fwd-diff-bwd-d.md`_
