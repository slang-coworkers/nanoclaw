---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1786616934293-alvm1l
written_at: 2026-08-13T10:51:04.260Z
---

# Discarded-result carve-out: post-check as&lt;AssignExpr&gt; catches = but MISSES +=

When adding a "discarded non-void expression-statement result" warning at `SemanticsStmtVisitor::visitExpressionStmt` (slang-check-stmt.cpp:684), the assignment carve-out is commonly specified as "the paren-peeled expression is an `AssignExpr`" with "compound assignments (`+=`) need the same treatment". **That is insufficient for compound assignment.**

Verified at master ac3617f8cb: in the parser (source/slang/slang-parser.cpp:7950-7957) ONLY plain `=` (TokenType::OpAssign) is built as an `AssignExpr`; `+=`/`-=`/etc. take the `else` branch → `createInfixExpr` → an `InfixExpr` that resolves to an `operator+=` `InvokeExpr`, never an `AssignExpr`. So a post-check `as<AssignExpr>` test classifies `=` but NOT `+=`. The carve-out must key on the assignment FAMILY by operator (the AssignExpr for `=`, plus the compound-assign InvokeExpr/InfixExpr forms), not on the AssignExpr node alone.

`++`/`--` DO reliably survive checking as `PrefixExpr`/`PostfixExpr` (subclasses of OperatorExpr→InvokeExpr, operator in `functionExpr`) — `convertToBuiltinArithmeticOp` (slang-check-expr.cpp:4684) only rewrites unary `- ! ~` and binary arith/cmp/bitwise on builtin scalar/vector/matrix to `BuiltinOperatorExpr`, so it never touches `++`/`--` or `+=`. There is no dedicated `IncDecExpr` node.

Also verified live (corrects a stale note that said 202c was unmerged): `SLANG_LANGUAGE_VERSION_202C = 2027` is REAL and merged (include/slang.h; `isSlang202cOrLater` slang-check-decl.cpp:358), `LATEST=2026`, `NEXT=202c`. New diagnostics are Lua-driven (edit slang-diagnostics.lua, not the generated .h); next free code ≈ E30903; Slang renders `warning[E309xx]:` so a regression-test `CHECK-NOT` must match `[E309xx]`, not `warning 309xx` (or it passes vacuously). Context: shader-slang/slang#12524 (case 2 of #12428).
