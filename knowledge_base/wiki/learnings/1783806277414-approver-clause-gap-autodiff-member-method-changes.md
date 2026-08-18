---
title: "[approver/clause-gap] Autodiff member-method changes must be checked across ALL higher-order operator paths — fwd/bwd AND the passthrough operators (primal_substitute, dispatch_kernel)"
type: learning
topic: review-approval
source: learnings/1783806277414-approver-clause-gap-autodiff-member-method-changes.md
---

# [approver/clause-gap] Autodiff member-method changes must be checked across ALL higher-order operator paths — fwd/bwd AND the passthrough operators (primal_substitute, dispatch_kernel)

**Context:** slang#11475 R2 (commit 84480de94f7f). The PR taught `getThisTypeForBaseFunc` / the fwd+bwd `HigherOrderInvokeExprCheckingActions` to synthesize an explicit `this` parameter for member-method operands (`bwd_diff(obj.method)`). Devin flagged, and I verified, a real PR-introduced asymmetry: the **passthrough** higher-order operators do NOT get the same treatment.

**Root cause / the class:** In `source/slang/slang-check-expr.cpp`, higher-order autodiff operators split into two families:
- `ForwardDifferentiateExprCheckingActions` / `BackwardDifferentiateExprCheckingActions` — their `fillHigherOrderInvokeExpr` was updated to add `if (thisType.type) newParameterNames.add("this")` (R2 ~line 5938-5939).
- `PassthroughHighOrderExprCheckingActionsBase<T>` — instantiated for `PrimalSubstituteExpr` (`primal_substitute`) and `DispatchKernelExpr` (`dispatch_kernel`) — its `fillHigherOrderInvokeExpr` (~5964-5992) sets `resultDiffExpr->type = baseFuncType` directly and only copies `param->getName()`, so it adds NO synthesized `this`. So `primal_substitute(obj.method)` / `dispatch_kernel(obj.method)` on a member expression silently skip the receiver the fwd/bwd paths now require.

This is the SAME inconsistency-class as the historical autodiff member-method bug in learning 1780050112745 (PR #10827 updated four resolvers but not the fifth + IR + front-end). When a change touches "how a member method is used as a higher-order operand," the checklist of paths to update/verify is: fwd_diff, bwd_diff, primal_substitute, dispatch_kernel, the `[Fwd/Backward/PrimalSubstitute]Of` derivative-attribute imaginary-call (slang-check-decl.cpp), the IR translator, and the front-end InvokeExpr lowering. Verifying only the operator named in the PR title misses the siblings.

**How to catch it (approver challenger):** grep for the sibling `*CheckingActions` structs and the passthrough base; diff which ones the PR touched vs which share the modified helper (`getThisTypeForBaseFunc` is called by all of them). A helper change that benefits only 2 of N call sites is a gap, not necessarily a bug — flag OPEN_GAP unless you can build a repro.

**Decision calibration (bonus):** this PR's revision chain went R0 BLOCK → R1 BLOCK → R2 ABSTAIN_POLICY:OPEN_GAP. The author fixed the *verified* decl-side arg-count bug (R1 rework, confirmed by Devin R2's "param-count guard prevents false this-argument injection" note) and improved generic/interface receiver typing (R2), which correctly moved the decision OFF block — but residual non-pre-existing 🟡 gaps (passthrough omission; DerefMemberExpr pointer-type-as-`this` still unfixed in both R2 branches; untested fwd_diff(member)) floored it at ABSTAIN, never rounding up to approve. Related: [[approver-challenger-miss-revision-fixup-can-fix-the-flagged]], [[slang-autodiff-pr-10827-left-bwddifffunctype-remat]].

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1783806277414-approver-clause-gap-autodiff-member-method-changes.md`_
