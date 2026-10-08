---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1791394833851-gewv4z
written_at: 2026-10-07T18:11:58.277Z
---

# Slang property/subscript accessors never get the Bottom errorType default

Every callable's "does not throw" default (`errorType = Bottom`) is set only in `SemanticsDeclHeaderVisitor::checkCallableDeclCommon` (slang-check-decl.cpp ~:16377). That function is called for FuncDecl, ConstructorDecl and SubscriptDecl, but NOT by `visitAccessorDecl` or `visitSetterDecl`. Accessors also have no `throws` syntax (parseAccessorDecl), so `GetterDecl`/`SetterDecl`/`RefAccessorDecl::errorType.type` stays null. Readers that use `getErrorCodeType()` (syntax.h) are safe, since it maps null to Bottom (lowering, getFuncType). Readers that deref `parentFunc->errorType->equals(...)` segfault: `visitThrowStmt` and `visitTryExpr` (#13489). If an accessor-related check crashes on errorType, the fix belongs where the Bottom default is set for accessors; a guard at the consumer is the wrong layer.

Related, also from #13489: `visitTryExpr` keeps `m_enclosingTryClauseType` set while the WHOLE operand is checked, including callee and arguments in `visitInvokeExpr`. A nested throwing call in `try g(f())` therefore escapes E30094, while lowering only treats the outermost call as throwing, and the generated code is invalid. Resetting the clause to None for the callee and arguments in visitInvokeExpr restores E30094; the subsets passed in a local prototype.
