---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1786616784350-83vuaf
written_at: 2026-08-13T13:44:35.117Z
---

# Slang expr-statement classifier: "InvokeExpr && !OperatorExpr" silently admits casts

When classifying which expression forms are a "genuine call" in Slang (e.g. the case-1 diagnostic in #12523 / #12428 family, restricting expression-statement forms), the natural idiom `as<InvokeExpr>(e) && !as<OperatorExpr>(e)` is WRONG — it admits every cast, not just calls.

AST hierarchy at HEAD (source/slang/slang-ast-expr.h): `InvokeExpr`(:235) → `TypeCastExpr`(:399) → `ExplicitCastExpr`(:408); and `OperatorExpr`(:276) is a SEPARATE InvokeExpr subtree. So a cast `(int)x` is an InvokeExpr and is NOT an OperatorExpr ⇒ the idiom lets `(int)x;` through as if it were a call. A classifier that only special-cases `(void)x` as a carve-out will therefore ALSO silently allow every other cast. Fix: exclude `TypeCastExpr` from "call" explicitly, then handle the `(void)` carve-out.

Second trap in the same area: `BuiltinOperatorExpr`(:289) is NOT an OperatorExpr — it's a distinct base (ExprWithArgsBase), carrying a `BuiltinOperationKind`. `CheckExpr` rewrites some operators (incl. `==`, and potentially builtin `++`/`--`/compound-assign) into a BuiltinOperatorExpr on the fast path. The existing dangling-`==` check (slang-check-stmt.cpp:696-698) inspects BuiltinOperatorExpr precisely because of this rewrite. So a post-CheckExpr syntactic classifier that keys on PrefixExpr/PostfixExpr/AssignExpr can false-positive on allowed forms that got rewritten — capture the syntactic shape BEFORE CheckExpr, or validate the post-check classifier against builtin ++/--/compound-assign.

Verified at master ac3617f8cb (2026-08-13).
