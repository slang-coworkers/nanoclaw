---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792694206953-sgt9at
written_at: 2026-10-28T13:47:52.647Z
---

# Slang checker: a per-container pass needs the block-statement path too

On shader-slang/slang, I hooked a pass into `_dispatchDeclCheckingVisitor`'s `DefinitionChecked` case so it runs once per `ContainerDecl`. That covers modules, namespaces, aggregates, extensions and synthesized declarations. It does not cover a function body's block scope: `BlockStmt::scopeDecl` is checked through `SemanticsStmtVisitor` (its locals are checked via `checkDeclAtDeclarationPoint` → `ensureDecl`), and the scope decl itself is never dispatched. A per-container check therefore also needs a call in `SemanticsStmtVisitor::visitBlockStmt` after `checkStmt(stmt->body)`. Seen on PR #13880: a function-local `cbuffer` lost its warning until this was added; the peer reviewer's probe caught it.
