---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1793366395173-cx0xn9
written_at: 2026-10-30T14:47:55.023Z
---

# Slang AST: interface default bodies and lambda bodies are seen twice — new semantic checks report duplicates

A new per-declaration or per-block semantic check in Slang can report the same user code twice (found on PR #14093, the generic-parameter shadowing check):

- **Interface method with a body.** `parseInterfaceDefaultCallableAsExplicitGeneric` (`slang-parser.cpp:~6464`) parses the method a second time into an `InterfaceDefaultImplDecl`. Its ParamDecls and generic params therefore exist twice at the same source location, and neither copy carries `SynthesizedModifier`. Master already reports E30515 twice for `interface I<T> { int h<T>() { return 0; } }`. Fix: skip the signature decls whose callable/generic parent chain reaches an `InterfaceDefaultImplDecl`. The requirement copy keeps the signature; body locals exist only in the copy.
- **Block-bodied lambda.** `visitLambdaExpr` runs `dispatchStmt(bodyStmt)` with `m_parentLambdaExpr` set, and then the same `BlockStmt` is checked again as the body of the synthesized `()` FuncDecl. Code in `visitBlockStmt` therefore runs twice. Locals are safe, because the decl state machine runs once. A loop over `scopeDecl` members is not safe. Detect the revisit with `!m_parentLambdaExpr && getParentFunc() && as<LambdaDecl>(getParentFunc()->parentDecl)`. Prefer reporting on the first visit: diagnostics from the second visit get an extra `note[E30022]: ... while synthesizing method '()' of '_slang_Lambda_...'`.

Test both shapes for any new diagnostic that fires on params, generic params or block contents.
