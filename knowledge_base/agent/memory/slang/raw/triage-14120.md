---
type: triage
description: #14120 — follow-up #2 of #14118 — forward reference binds a later local in __target_switch/__stage_switch cases, unbraced catch body, unbraced $for body (decl group). Not fixed by #14119. Filed as #14120.
---
# Triage: shader-slang/slang#14120 — locals readable before declaration in target-switch case / unbraced catch / unbraced $for
Date: 2026-10-31T02:55Z | bug | medium (silent wrong code; rare constructs) | P3 | frontend (parser + checker)
Origin: parent msg 14 (#14118 chain). Fixer's report on PR #14119 (head ee84ee78b, approach A for #14118).
Parent: do NOT hand to fixer yet — decision after #14119 review ($for design constraint).

## Evidence (runtime, slang-test -cpu + synthesized CUDA on L40S; files /tmp/t-nested/f2/tests/*.slang)
Own builds: wt-triage-master (7d679e657, 2026.20-95) and wt-triage-14119 (ee84ee78b, 2026.20-101), Release.
| shape | master | #14119 |
|---|---|---|
| target-switch.slang (`case cpp: r = i; int i = 5;` + default) | 0 | 0 |
| stage-switch.slang (`case compute:`) | 0 | 0 |
| catch-group.slang (unbraced `int a = record(z), z = 5;`) | 0 | 0 |
| cfor-group.slang (unbraced `$for` body, same group) | 0 | 0 |
| catch-group-braced / cfor-group-braced | 0 | 7 |
| block-group.slang (single-stmt block `{ int a = record(z), z = 5; }`) | 0 | 7 |
| target-switch-braced / block-group-2stmt (controls) | 7 | 7 |
Emitted C++: read goes to an unwritten module-scope `int32_t z_0;`/`i_0;`.

## Codebase digest (origin/master 7d679e657)
- `slang-parser.cpp:6959` parseTargetSwitchStmtImpl: pushes a ScopeDecl per case group (`:6970`), never stored;
  `TargetCaseStmt` (`slang-ast-stmt.h:138`) has no scopeDecl; body = stmt/SeqStmt. Checker `visitTargetSwitchStmt`
  (`slang-check-stmt.cpp:488`) / `visitTargetCaseStmt` (`:533`).
- `slang-parser.cpp:7882` ParseDoCatchStatement: pushes scope with errorVar (ParamDecl), handleBody parsed in it;
  `CatchStmt` (`slang-ast-stmt.h:306`) not a ScopeStmt. `visitCatchStmt` (`:707`) reveals errorVar only.
- `slang-parser.cpp:7210` parseCompileTimeForStmt: scope holds loop `varDecl` (VarDecl, no DeclStmt) + unbraced body decls;
  `visitCompileTimeForStmt` (`:361`) hides nothing. GpuForeach (`:7085`) also AddMember's a VarDecl with no DeclStmt.
- master visitBlockStmt hides only when `stmt->body` is a SeqStmt → single-statement block not hidden (fixed by #14119's
  `hideLocalVarsUntilDeclared(scopeDecl)`, which uses getDirectMemberDeclsOfType<VarDecl> — excludes ParamDecl).

## Approaches
- **A (suggested):** wrap each body in a scoped BlockStmt: target case body ← case ScopeDecl; catch body ← catch scope
  (errorVar ParamDecl not hidden by the VarDecl-only helper; visitCatchStmt reveals it); `$for` body parsed in a nested
  scope so the loop var stays outside. Reuses visitBlockStmt; precedent parseIfLetStatement. Risk: extra DebugLexicalBlock.
- **B:** hide by DeclStmt instead of by scope (walk the function body once; reveal at decl point). Uniform; replaces
  #14119's per-scope helper → fits if #14119 review asks for a general rule.
- **C:** per-construct hide calls with exemptions — smallest, but special cases + target-case scope still needs storing.
- Tests: the 4 shapes (expect 7) + braced/multi-stmt controls + block-scope-forward-ref-rejected.slang.

## Dedup
Not dup: #14118 (unbraced if/else/while/do; fixed by #14119), #13720 (variable NOT visible in its own initializer —
opposite direction), #13752 (shadowing diagnostics), #13428 (closed; multi-declarator `k = j < 2` E30015).
