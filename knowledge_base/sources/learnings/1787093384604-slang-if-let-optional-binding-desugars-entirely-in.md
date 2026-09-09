---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787092990177-j2ebuj
written_at: 2026-08-18T22:49:44.604Z
---

# Slang if(let) optional binding desugars entirely in the parser

`if (let x = optional)` in Slang is desugared **entirely in the parser**, not the checker or IR lowering. See `source/slang/slang-parser.cpp`:

- Dispatch: `parseStatement` peeks `LookAheadToken("let", 2)` after `if` (line ~6931) → calls `parseIfLetStatement()`.
- `parseIfLetStatement()` (line 7302) builds a plain `IfStmt`:
  - Wraps everything in a `ScopeDecl` + `SeqStmt`.
  - Emits `let $OptVar = <initExpr>;` as a `DeclStmt` before the if.
  - Predicate = `constructIfLetPredicate` (line 7290) → a `MemberExpr` `$OptVar.hasValue`.
  - Positive branch is prefixed with `let <userVar> = $OptVar.value;` (a `MemberExpr` on `value`).
- Downstream, the checker sees only ordinary member accesses (`hasValue`, `value`) and `checkPredicateExpr` (slang-check-stmt.cpp:257) coerces the bool `hasValue` result; IR lowering (`visitIfStmt`, slang-lower-to-ir.cpp:8286) sees a normal `IfStmt` and calls `emitIfElse`.

`Optional<T>` is defined in `source/slang/core.meta.slang:1822-1847`: `hasValue` property → `kIROp_OptionalHasValue`, `value` property → `kIROp_GetOptionalValue`, implicit-conversion `__init(T)` → `kIROp_MakeOptionalValue`. IR builder helpers: `emitOptionalHasValue`/`emitGetOptionalValue`/`emitMakeOptionalValue`/`emitMakeOptionalNone` at slang-ir.cpp:4841-4863.

Fallible cast `a as B` is `AsTypeExpr`; its type is `Optional<B>` (checker sets `getOptionalType`, slang-check-expr.cpp:7759), and `visitAsTypeExpr` (slang-lower-to-ir.cpp:7378) lowers it to an if/else on `IsType`/`TypeEquals` that stores `MakeOptionalValue` vs `MakeOptionalNone`.

Implication for a `let ... else` guard: the cleanest implementation mirrors `parseIfLetStatement` at the parser level — bind `$OptVar`, test `.hasValue`, hoist `let x = $OptVar.value` into the enclosing (fall-through) scope, and put the user's `else` block on the false arm (which must diverge). No new checker/IR machinery is needed.
