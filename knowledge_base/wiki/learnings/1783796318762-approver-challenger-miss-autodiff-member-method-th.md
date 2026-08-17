---
title: "[approver/challenger-miss] autodiff member-method this-argument contract must be checked on BOTH sides + all reference/receiver shapes"
type: learning
topic: review-approval
source: learnings/1783796318762-approver-challenger-miss-autodiff-member-method-th.md
---

# [approver/challenger-miss] autodiff member-method this-argument contract must be checked on BOTH sides + all reference/receiver shapes

**Context:** slang#11475 "Fix bwd_diff on member expressions by requiring the `this` object as an explicit argument" (author saipraveenb25). Decided **BLOCK**. This is the same bug-class as learning `1780050112745` (PR #10827 left member-method diff-operand handling inconsistent across resolvers/IR/front-end). When an autodiff PR changes how `this` is threaded for `fwd_diff`/`bwd_diff`/`[Fwd|Backward]DerivativeOf` on member methods, the `this`-argument contract has TWO independently-edited sides and MULTIPLE reference/receiver shapes that must all agree. Probe each:

1. **Both sides of the contract must agree on arg count.** slang#11475 added an imaginary-`this` at arg-0 in the derivative-of *attribute check* (`slang-check-decl.cpp` `_tryCreateImaginaryThisArgForDerivativeOfAttribute`, keyed on the DERIVATIVE method having implicit `this`), but the paired *higher-order type builder* (`slang-check-expr.cpp` `getThisTypeForBaseFunc`) only adds the leading `this` when the ORIGINAL is a Member/StaticMemberExpr — a bare `DeclRef` (`[BackwardDerivativeOf(f)]` on a sibling member by name) returns a null this-type. Mismatched keys → arg-count asymmetry (Devin's confirmed 🔴).

2. **`as<MemberExpr>` silently matches `DerefMemberExpr`.** `DerefMemberExpr : public MemberExpr` (slang-ast-expr.h). Any new `as<MemberExpr>(e)` branch that reads `e->baseExpression->type` will, for `p->method`, get the POINTER type (`Ptr<S>`), not the pointee `S`. Pointer differentiation is a REAL (experimental) path — IDifferentiablePtrType, SPIR-V/C++/CUDA. Precedent exists at slang-check-expr.cpp:~8858 (`as<DerefMemberExpr>(expr) && !as<PtrType>(expr->baseExpression->type)`) — new code that doesn't mirror that distinction is suspect.

3. **`getThisTypeForBaseFunc` (and friends) feed BOTH fwd and bwd checking actions.** A PR that tests only `bwd_diff` leaves the shared `fwd_diff(member)` path unexercised — and there's an existing DISABLE_DIAGNOSTIC_TEST (`tests/diagnostics/autodiff-non-static-member-diff-operand.slang`) documenting `__fwd_diff(foo.compute)` SEGFAULTS. Untested shared path over a known-crash surface = plausible-real gap.

**How to catch it:** for any member-method autodiff `this`-threading change, grep both `slang-check-decl.cpp` (derivative-of attribute checking) and `slang-check-expr.cpp` (higher-order type building) for the paired edits; enumerate reference shapes (Type::method / value.method / p->method / bare `f`) and operators (fwd/bwd/DerivativeOf), and check the PR's tests cover each — especially fwd_diff and pointer/DerefMemberExpr receivers. Missing coverage on a shape the change touches, or an asymmetry between the two files, is the signal.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783796318762-approver-challenger-miss-autodiff-member-method-th.md`_
