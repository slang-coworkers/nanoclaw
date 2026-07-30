---
name: project_12266_defer_bare_decl_scope_leak_crash
description: "slang#12266 — bare `defer uint i=1;` leaks decl into enclosing scope → segfault on reference; parser scope fix (Approach A)"
metadata: 
  node_type: memory
  type: project
  originSessionId: 2e0c2f28-dbc4-48a8-9626-3014cc4b7802
---

# slang#12266 — deferred bare var-decl scope-leak crash

**Filed:** 2026-07-29 by **skiminki-nv** (maintainer). Type "Language Maturity" (human-set, leave). Labels `Dev Opened`. Reporter proposed a concrete fix.

**Bug:** A bare (non-block) deferred variable declaration leaks its name into the *enclosing* scope. `defer uint i = 1;` makes `i` visible to sibling stmts; referencing it SEGFAULTS (exit 139, target-independent) instead of `error[E30015] undefined identifier`. Block form `defer { uint i=1; }` is correctly scoped and already yields E30015.

**Repro @HEAD `71a3f7e71`:**
```slang
RWStructuredBuffer<uint> output;
[numthreads(1,1,1)] void computeMain() { defer uint i = 1; output[0] = i; }
```
`slangc -target hlsl -entry computeMain -stage compute` → segfault.

**Root cause (VERIFIED by source read):** `Parser::ParseDeferStatement()` slang-parser.cpp:7571-7578 calls `ParseStatement()` with NO `pushScopeAndSetParent()`, so the deferred decl inserts into the enclosing function scope. Contrast `parseBlockStatement` (7130-7142) + if/for/while bodies which push a scope. Semantic `visitDeferStmt` (slang-check-stmt.cpp:624-628) only wraps `WithOuterStmt`, no lexical scope. Leak → lookup resolves `i` → IR lowers `i`'s IRVar into deferBlock (relocated to scope-exit by lowerDefer pass) → null/stale deref = segfault. (Exact IR null-deref line UNVERIFIED — do not cite.)

**Fix = Approach A (RECOMMENDED, = reporter's proposal):** open a nested `ScopeDecl` + `pushScopeAndSetParent` around the deferred stmt in the parser, mirroring parseBlockStatement. Nested (not isolated) → outer vars still visible so legit `defer output[0]=x;` still compiles. May need a `DeferStmt.scopeDecl` field (FIDDLE regen). Approaches B (checker-only — too late, decl already in containerDecl) and C (reject bare defer — contradicts docs) REJECTED.

**Test:** DIAGNOSTIC_TEST expecting E30015 for `defer uint i=1; ...=i;` + positive tests for outer-var defer and block-form defer. CPU-friendly.

**Chain:** triage DONE + verdict posted @HEAD → fixer → **DRAFT PR #12269** OPEN (base `master@71a3f7e71a`, `Closes #12266`, `pr: non-breaking`, +25/2 files; 9-line nested-ScopeDecl push/pop in ParseDeferStatement mirroring block/do-catch + DIAGNOSTIC test expecting E30015; NO AST/FIDDLE change). Repro now E30015 (exit 255, was segfault 139); `defer/` 38/38, `error-handling/` 32/32, defer-infinite-loop 1/1 PASS; build 1184/1184; codex PLAN+CODE+OUTPUT approved. CI reds none (draft priority-yield skips are benign). Issue verdict comment `5121153624` refreshed → "fixed in draft #12269, held for review".
- **Review:** slang-reviewer dispatched by Main 07-29 (triager lacks reviewer edge). Peer review pending.
- **Next human action:** skiminki-nv is requested reviewer + assignee — his to review/mark-ready/merge, OR he may prefer to own the fix himself (→ close draft). Mark-ready+merge OP/maintainer-gated. Canonical thread `gh-issue-shader-slang/slang-12266`.

**Related (NOT dup):** #12261 (statement labels on non-breakable stmts) — same-author language-hardening family. Feature origin PR #6619 (defer, merged 2025-04-07).
