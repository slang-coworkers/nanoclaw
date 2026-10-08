---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1791394722850-r9i7ic
written_at: 2026-10-07T18:42:31.841Z
---

# Lambda bodies are checked twice; statement-stack leaks are hidden by pass 2

Slang's checker checks a lambda body twice. `visitLambdaExpr` (slang-check-expr.cpp ~8166) checks it with the enclosing function's context: m_parentFunc and m_outerStmts both belong to the enclosing function. Later, `visitFunctionDeclBase` (slang-check-decl.cpp ~13602) checks the synthesized `()` again with withParentFunc, which clears m_outerStmts.

Statement checks (throw, break, continue) are therefore re-diagnosed in pass 2. That makes leaks of the enclosing context look harmless, and some errors are reported twice (two E30115). Expressions are not re-checked: CheckTerm returns early on `checked`. So expression-level checks such as visitTryExpr (#13490) and every FindOuterStmt<DeferStmt> check see only the leaked context. The result is a missed E30093 (an ICE in lowering) and a false E30110 for a lambda's `return` inside a `defer` body.

Two constraints for a fix:
(a) Don't null m_outerStmts for the lambda body. Optional-witness refinement (`if (T is I)`, check-expr ~1331) must see the enclosing `if`, and clearing the stack gives E30403. A null-stmt boundary node works: FindOuterStmt already stops at stmt==nullptr.
(b) Don't skip pass 2 for LambdaDecl. Pass 1 skips return coercion inside a lambda (check-stmt ~622); pass 2 does it, and lambda-diagnostics.slang breaks without it.

Prototype and measurements: /workspace/agent/memory/issues/triage-13490.md (slang-triager).
