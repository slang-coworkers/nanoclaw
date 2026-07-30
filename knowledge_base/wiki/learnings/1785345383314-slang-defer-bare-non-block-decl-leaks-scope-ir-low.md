---
title: "Slang defer bare non-block decl leaks scope → IR-lowering segfault (root cause: parser opens no scope)"
type: learning
topic: slang-compiler
source: learnings/1785345383314-slang-defer-bare-non-block-decl-leaks-scope-ir-low.md
---

# Slang defer bare non-block decl leaks scope → IR-lowering segfault (root cause: parser opens no scope)

**shader-slang/slang#12266** (verified @HEAD 71a3f7e71). A bare (non-block) deferred statement is parsed/checked in the ENCLOSING scope with no nested scope, so `defer uint i = 1;` leaks `i` into the function scope. Referencing that `i` then SEGFAULTS (target-independent) instead of giving `E30015 undefined identifier`.

**Why:** `Parser::ParseDeferStatement()` (source/slang/slang-parser.cpp:7571-7578) calls `ParseStatement()` WITHOUT `pushScopeAndSetParent()` — unlike `parseBlockStatement` (7130-7142) and the if/for/while body paths — so `parseVarDeclrStatement` registers the decl into `currentScope->containerDecl` (= function scope). `SemanticsStmtVisitor::visitDeferStmt` (slang-check-stmt.cpp:624-628) also opens no lexical scope (only `WithOuterStmt` for break/continue escape checks). Name lookup then resolves the leaked var (suppressing E30015); IR lowering places its `IRVar` in the defer block which the `lowerDefer` pass relocates to scope-exit, so a reference BEFORE scope-exit derefs a stale/unbound lowered value → crash.

**Fix (reporter's own proposal, validated):** open a NESTED scope around the deferred statement in the parser (mirror parseBlockStatement / if-body) so `defer <stmt>;` == `defer { <stmt>; }`. Nested, not isolated — legit `defer output[0]=x;` using an outer var must keep working. The block form `defer { uint i=1; }` is already correctly scoped (produces E30015) — that's the empirical proof the direction is right.

**Broader note:** `if(c) uint i=1;` / `while(c) uint i=1;` single-statement bodies ALSO leak the decl into the enclosing scope, but do NOT crash — only `defer` crashes because of the scope-exit relocation. So the leak is a general single-statement-body scoping quirk; the *crash* is defer-specific.

**Method reminder:** the specific IR null-deref line (getSimpleVal→null near slang-lower-to-ir.cpp:10277/10313) was a subagent hypothesis, NOT independently verified — kept out of the public verdict as fact. Front-end root cause WAS verified by direct source read.

**Infra gotcha:** `gh auth status` reports the nv-slang-bot App token as "invalid" and `gh api user` 403s "Resource not accessible by integration" — this is NORMAL for a GitHub App token (can't read /user). Repo-scoped calls (`gh api repos/.../issues/...`, label POST, comment POST) work fine. Don't treat the /user 403 as an auth outage.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1785345383314-slang-defer-bare-non-block-decl-leaks-scope-ir-low.md`_
