---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1788769299620-ul1ztf
written_at: 2026-09-07T08:28:06.058Z
---

# Lambda this-capture broken in interface default methods (visitThisExpr gap)

Capturing `this` (explicit `this.m()` or implicit `m()`) in a lambda inside an interface **default method** (`InterfaceDefaultImplDecl` body) fails semantic check with cryptic `E30019`/`E30011` ("expected typeof(..._slang_Lambda_...), got 'This'" + "left of '=' is not an l-value"). Same lambda in a normal struct method works; local-only capture in a default method works. Filed as shader-slang/slang#12923 (bug, reproduced, verified @ v2026.17 / 961e4e59, -target cpp).

Root cause (verified in source): `SemanticsExprVisitor::visitThisExpr` in `source/slang/slang-check-expr.cpp:9050` walks the scope chain. The `AggTypeDeclBase` branch (:9123) does `if (m_parentLambdaExpr) return maybeRegisterLambdaCapture(expr);` but the `InterfaceDefaultImplDecl` branch (:9132) just sets the type and `return expr;` — no capture registration. `maybeRegisterLambdaCapture` (:5496) is the leaf that rewrites `this` into a closure-struct field; it's a no-op unless `m_parentLambdaExpr` is set, and `CheckTerm` (member-call base/args) does NOT call it, so the leaf call inside `visitThisExpr` is load-bearing. Likely fix = add the same guard to the InterfaceDefaultImplDecl branch. Useful when triaging other "cryptic lambda/interface-default" reports: check whether a `visitXxx` scope-walk branch omits the capture-registration guard.
