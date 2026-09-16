---
title: "Slang accessor mutability lives at THREE decision points — miss visitThisExpr and the body can't mutate `this`"
type: learning
topic: slang-compiler
source: learnings/1789494119289-slang-accessor-mutability-lives-at-three-decision-.md
superseded_by: 1789496013141-slang-accessor-mutability-is-four-sites-implicit-v
---

# Slang accessor mutability lives at THREE decision points — miss visitThisExpr and the body can't mutate `this`

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1786529254007-r9hioo
written_at: 2026-09-15T17:41:59.289Z
---

# Slang accessor mutability lives at THREE decision points — miss visitThisExpr and the body can't mutate `this`

Making a Slang accessor (or member function) implicitly mutating requires updating THREE independent decision points; updating only some produces a silent asymmetry:

1. **`isEffectivelyMutating`** (`slang-check-overload.cpp` ~1016-1035) — governs whether the CALLER needs a mutable base (so `obj.p = x` on an immutable/`let` base is rejected).
2. **`getDeclaredParamPassingModeForImplicitThisParam`** (`slang-lower-to-ir.cpp` ~3860-3896) — governs how the implicit `this` is PASSED (`BorrowInOut` = by-reference vs `In` = by-value copy).
3. **`SemanticsExprVisitor::visitThisExpr`** (`slang-check-expr.cpp` ~9062-9092) — governs whether `this` is an L-VALUE INSIDE THE ACCESSOR/FUNCTION BODY, so the body may assign to a `this` field. It sets `isLeftValue=true` only for `ConstructorDecl`, `SetterDecl`, `MutatingAttribute`, `RefAttribute`.

Real case (PR #12492 round 3, Option A: unannotated `ref` accessor → implicitly mutating): the fix updated points 1 and 2 but MISSED point 3. Result: an unannotated `ref { _v = _v + 1; return _v; }` (mutating a `this`-field in the body) is spuriously rejected with `left of '=' is not an l-value` (E30011), while `[mutating] ref { _v = _v+1; ... }` compiles (MutatingAttribute branch fires) — the two spellings the change intends to be equivalent are not. Fix: add a `RefAccessorDecl` branch to `visitThisExpr` that respects `[nonmutating]`. Tests that only use passthrough `ref { return _v; }` (return-only, no in-body mutation) will NOT catch this — you need a mutate-then-return body test.

REVIEWER TAKEAWAY: for any "make X implicitly mutating" / accessor-mutability change, grep all THREE sites and confirm each is updated; a body-mutation test (not just a return-passthrough test) is required to exercise point 3. This is the same "incomplete propagation across decision points" shape as the original set/ref asymmetry (`RefAccessorDecl` missing from the set-mutating deciders) that these PRs were fixing in the first place.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1789494119289-slang-accessor-mutability-lives-at-three-decision-.md`_
