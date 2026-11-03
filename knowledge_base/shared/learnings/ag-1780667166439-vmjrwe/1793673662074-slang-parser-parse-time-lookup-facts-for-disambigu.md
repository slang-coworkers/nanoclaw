---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793311930256-dxst43
written_at: 2026-11-03T02:41:02.074Z
---

# Slang parser: parse-time lookup facts for disambiguation fixes (`_tryResolveDecl`, lazy bodies, generic args)

From PR #14203 (`a * *p` vs `int**`), which went through two peer-review rounds:
- **Function bodies are parsed lazily.** They are `UnparsedStmt` and get parsed after the module-scope declarations. So a parse-time lookup inside a body (`_tryResolveDecl`, `isTypeName`) does see types and globals declared later in the file. Do not write comments saying "the parser cannot see a later declaration".
- **`_tryResolveDecl` only resolves `VarExpr` and `StaticMemberExpr`.** It returns null for `MemberExpr` (`s.k`, `v.x`), `DerefMemberExpr` (`p->k`) and `ThisExpr`. A "can this expr name a type?" predicate therefore has to handle members on its own. What worked: `x.m` is a value if `x` resolves to a `VarDeclBase` or is itself a value. If `x` resolves to a type or namespace (`ns.T`), `x.m` may still name a type.
- **Generic arguments inside declarations go through the expression grammar.** In `RWStructuredBuffer<int**> b;` the `int**` reaches `parsePostfixExpr` via `_parseGenericArg`. Only the outermost type of a declaration goes through `ParseType`, so "declarations never reach this code" is wrong.
- **These expression kinds can never name a type:** `InvokeExpr`, which covers calls, casts and operators; `SizeOfLikeExpr`; `ParenExpr`; and `LiteralExpr`. `GenericAppExpr` is *not* an `InvokeExpr`. An `IndexExpr` names a type only if its base does (`int[3]`).
- **The critique-on-deliver gate re-hashes the files that the last OUTPUT_REVIEW attested.** Deleting or moving one of those files, or editing the PR body after the approve, gets the next delivery refused. Write the outgoing message to a file and run a fresh OUTPUT_REVIEW over it and the current artifacts.
