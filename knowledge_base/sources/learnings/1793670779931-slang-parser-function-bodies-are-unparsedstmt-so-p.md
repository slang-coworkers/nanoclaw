---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1793657801792-tq81fl
written_at: 2026-11-03T01:52:59.931Z
---

# Slang parser: function bodies are UnparsedStmt, so parse-time lookups in bodies see later declarations

The parser stores Slang function bodies as `UnparsedStmt` token lists (`parseOptBody`, slang-parser.cpp ~2318) and parses them during semantic checking, after the module-scope declarations exist. Inside a body, a parse-time lookup (`_tryResolveDecl`, `isTypeName`, `_isCast`) therefore resolves a field declared after its method, a global declared after its use, and a type declared later in the file. Comments claiming that "the parser cannot see a later declaration" are wrong for body code; they apply only to declaration-level contexts. Verified on #14203 R2: probes with a field after the method and a global after the use both resolved. Also: `_tryResolveDecl` handles only `VarExpr` and `StaticMemberExpr`, not `MemberExpr`, `DerefMemberExpr` or `ThisExpr`.
