---
type: triage
description: #14118 — Slang-mode local declared as an unbraced if/else/while/do body is visible BEFORE its declaration → wrong binding, global/invalid-SPIR-V read. Follow-up from #14099/#14115. Filed as #14118.
---
# Triage: shader-slang/slang#14118 — local in unbraced statement body visible before its declaration (Slang mode)
Date: 2026-10-31T01:0xZ | bug | medium (silent wrong code + invalid SPIR-V; unusual shape) | P2 | frontend (checker)
Origin: parent msg 6 (#14099 chain) — fixer saw it while doing approach A; tangent-vector chose B (DXC scoping) for #14099
(cmt 6535132734), PR #14115 head ea4cbbfe0 does not touch this.

## Repro (facts, near-master 2026.20-97-ge961f2162; also v2026.20, v2025.18.2)
`{ value = i; if (c) int i = 1; }` in `int f(int i, bool c)` (/tmp/t-nested/repro.slang):
- HLSL: `int i_0;` module global; `f_0(int i_1, …) { return i_0; }` (param ignored).
- SPIR-V: validator "Variables can not have a function[7] storage class outside of a function" (`%i_0 = OpVariable
  %_ptr_Function_int Function` at module scope); without SLANG_RUN_SPIRV_VALIDATION slangc exits 0.
- Runtime (slang-test from wt-13734 2026.20-2, temp root /tmp/t-nested/root): -cpu → 0 (want 7); -vk L40S → segfault 2/2;
  control (inner renamed `j`) passes on -vk.
- Same for `else` body, `while` body, `do` body. Braced body / direct-child decl → correct (reads param).
- g++ reference: 7. gcc (C) rejects `if (c) int i = 1;` ("expected expression before 'int'").
- Second shape kept by A: `if (c) int i = 1; value = i;` → HLSL `return int(1)`; C++ gives 7 (documented leak).

## Codebase digest (origin/master 7d679e657)
- `slang-parser.cpp:7773` parseIfStatement / `:7857` ParseWhileStatement / `:7869` ParseDoWhileStatement — no scope for an
  unbraced body; `:7630` parseVarDeclrStatement adds to `currentScope->containerDecl` = enclosing block's ScopeDecl.
- `slang-check-stmt.cpp:128-145` visitBlockStmt hides only direct-child DeclStmt decls of the block SeqStmt;
  `:75-87` checkDeclAtDeclarationPoint reveals. `slang-lookup.cpp:174` `_isUncheckedLocalVar`.
- Generated design doc `docs/generated/design/name-resolution/scopes.md` (~line 118) documents the leak AFTER the statement;
  generated tests `docs/generated/tests/design/name-resolution/scopes/{if,while,do}-body-decl-without-block-leaks.slang`
  pin it. Same doc (README C46) says a block-local is invisible to a forward reference → this bug violates C46.
- `parseIfLetStatement` (`:7677`) already wraps its positive branch in a scoped BlockStmt (precedent for B).

## Approaches
- **A (rec): visitBlockStmt hides every local VarDecl owned by `stmt->scopeDecl`** (not only direct DeclStmt children).
  Non-breaking; generated leak tests keep passing; fixes if/else/while/do forms. Audit locals with no DeclStmt (catch
  `errorVar` revealed at check-stmt.cpp:712; cbuffer transparent members — not local vars). Fixer's reference patch
  `patches/fix-14099-hide-nested-locals.patch` (its workspace) is this shape.
- **B: C++ implicit scope for non-block substatements** of if/else/while/do (wrap in scoped BlockStmt). Also fixes the
  after-statement shape. Language change; reverses the generated doc + 3 tests. tangent-vector favoured modern scoping
  on #14099 — may want this, but it's their call.
- **C: reject a declaration as an unbraced body** (C rule). Breaking.
- Accept: repro COMPARE_COMPUTE (-cpu + -vk) writes 7; else/while/do variants; braced + direct controls unchanged;
  3 generated leak tests pass; `{ x = y; int y; }` still rejected (block-scope-forward-ref-rejected.slang).

## Dedup
Not a dup: #13752 (shadowing diagnostics), #13720 (variable visible in its own initializer), #13435 (local-type static
const reads local). Searches: declared later visible / used before declaration local / hiddenFromLookup / function
storage class outside of a function / if without braces declaration.
