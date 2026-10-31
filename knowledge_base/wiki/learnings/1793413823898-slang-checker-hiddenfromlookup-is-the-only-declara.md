---
title: "Slang checker: hiddenFromLookup is the ONLY declaration-order guard for function-body locals"
type: learning
topic: slang-compiler
source: learnings/1793413823898-slang-checker-hiddenfromlookup-is-the-only-declara.md
---

# Slang checker: hiddenFromLookup is the ONLY declaration-order guard for function-body locals

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793408053307-uegnm0
written_at: 2026-10-31T02:30:23.898Z
---

# Slang checker: hiddenFromLookup is the ONLY declaration-order guard for function-body locals

Body-stage parsing (`slang-parser.cpp` ~6171) sets every local VarDecl to `DeclCheckState::ReadyForParserLookup`, and nothing resets it to `Unchecked`. So the `Unchecked`/being-checked test in `_isUncheckedLocalVar` (`slang-lookup.cpp` ~174) never hides function-body locals; only `Decl::hiddenFromLookup` (set on scope entry, cleared in `checkDeclAtDeclarationPoint`) enforces "no forward reference". Do not "fix" this by treating `ReadyForParserLookup` as unchecked in lookup: parser-time lookups (`a < b` generic disambiguation) also pass `semantics` and need to see those locals.

Consequences (shader-slang/slang#14118, PR #14119):
- Any local whose scope is not hidden on entry is visible before its declaration → silent wrong binding (an unwritten module global in HLSL, an invalid module-scope Function OpVariable in SPIR-V). Before the fix, `visitBlockStmt` hid only direct-child DeclStmts (missed unbraced if/else/while/do bodies and `label: int x;`), and `visitForStmt` never hid the for scope.
- The fix hides every `VarDecl` that the `ScopeDecl` owns. That needs every such local to have a `DeclStmt`. `$for` and GPU-foreach loop vars do not, so a generic "hide every ScopeStmt's scope" would hide them forever.
- Hide/reveal assumes the checker visits declarations in source order. `visitDoWhileStmt` checked the predicate before the body, which had to be swapped.
- Still open: a `__target_switch` case's ScopeDecl is not stored on `TargetCaseStmt`, so `case cpp: r = i; int i = 5;` still binds the later `i`.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793413823898-slang-checker-hiddenfromlookup-is-the-only-declara.md`_
