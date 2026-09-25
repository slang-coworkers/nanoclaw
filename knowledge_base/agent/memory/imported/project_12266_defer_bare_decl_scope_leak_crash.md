---
name: project_12266_defer_bare_decl_scope_leak_crash
description: "slang#12266 — bare `defer uint i=1;` leaks decl into enclosing scope → segfault on reference; parser scope fix (Approach A). TERMINAL: PR #12269 closed-unmerged on maintainer design disagreement; crash still live upstream."
metadata: 
  node_type: memory
  type: project
  originSessionId: 2e0c2f28-dbc4-48a8-9626-3014cc4b7802
---

# slang#12266 — deferred bare var-decl scope-leak crash

**Filed** 2026-07-29 by **skiminki-nv** (maintainer). Type "Language Maturity" (human-set).
🔴 **TERMINAL on our side** — issue OPEN, crash UNFIXED upstream. Canonical thread
`gh-issue-shader-slang/slang-12266`.

## The bug
A bare (non-block) deferred variable declaration leaks its name into the *enclosing* scope.
`defer uint i = 1;` makes `i` visible to sibling stmts; referencing it SEGFAULTS (exit 139,
target-independent) instead of `error[E30015] undefined identifier`. Block form
`defer { uint i=1; }` is correctly scoped and already yields E30015.

**Repro @HEAD `71a3f7e71`:**
```slang
RWStructuredBuffer<uint> output;
[numthreads(1,1,1)] void computeMain() { defer uint i = 1; output[0] = i; }
```
`slangc -target hlsl -entry computeMain -stage compute` → segfault.

**Root cause (source-verified):** `Parser::ParseDeferStatement()` slang-parser.cpp:7571-7578
calls `ParseStatement()` with NO `pushScopeAndSetParent()`, so the deferred decl inserts into
the enclosing function scope — unlike `parseBlockStatement` (7130-7142) and if/for/while bodies
which push a scope. Semantic `visitDeferStmt` (slang-check-stmt.cpp:624-628) only wraps
`WithOuterStmt`, no lexical scope. Leak → lookup resolves `i` → IR lowers its IRVar into the
deferBlock (relocated to scope-exit by lowerDefer) → null/stale deref = segfault.

**Fix = Approach A** (= reporter's proposal): open a nested `ScopeDecl` +
`pushScopeAndSetParent` around the deferred stmt in the parser, mirroring `parseBlockStatement`.
Nested (not isolated) so outer vars stay visible (`defer output[0]=x;` still compiles). No
scopeDecl field needed — all 5 DeferStmt consumers recurse only into `stmt->statement`, not via
ScopeDecl membership (mirrors do/catch). Approaches B (checker-only — too late) and C (reject
bare defer — contradicts docs) rejected.

## Crash family — 4 forms, broader than reported (triager-measured @master `9eb90c50a`, their receipts)
| form | result |
|---|---|
| `defer uint i=1;` | **139 segfault** |
| `defer if(…) uint i=1;` | **139** |
| `defer while(false) uint i=1;` | **139** |
| `defer do int i=1; while(false);` | **139** |
| `defer for(;;) int i=1;` | ✅ E30015 already correct — the `for` parser pushes a scope |

⇒ skiminki's "we'll just keep patching corner cases" is empirically true; the `for` arm working
confirms the diagnosis. The leak class is broader than `defer`: `if (false) int i = 1;` + a read
of `i` is legal Slang 2026 today (same decl-scoping question outside `defer`).

## Design fork — SETTLED, scoped OUT of this PR
Two CODEOWNERS split: skiminki-nv → Approach A (silently scope the bare decl); csyonghe → make a
decl-only `DeferStmt` inner ILLEGAL. Settled 2026-08-04 (comment `5182866965`): both agree the
future-language end-state disallows nonsensical `defer` statements (keep only `defer exprStmt;`
and `defer blockStmt`), and both scope that redesign to **Slang 202c / #12296**
([[project_12296_empty_statement_error_contexts]]), NOT this PR. **Consequence:** #12269 was the
correct INTERIM non-breaking crash fix; the agreed end-state would later disallow the bare *decl*
form, but both keeper forms keep working unchanged so there is no conflict. Note: csyonghe's
illegal-path is strictly MORE breaking than A — `defer int x = sideEffect();` with no reference
compiles+runs today (init fires at scope-exit; only a *reference* crashes), so A stays
`pr: non-breaking` while illegal-path flips to `pr: breaking change`.

## PR #12269 — CLOSED UNMERGED 2026-08-06 (design, not code)
Draft opened @`71a3f7e71a` (`Closes #12266`, `pr: non-breaking`, 9-line nested-ScopeDecl push/pop
+ DIAGNOSTIC test expecting E30015, no AST/FIDDLE change; repro → E30015). skiminki flipped it
draft→ready himself (maintainer action, not a drafts-only breach). **Internal review was CLEAN —
`APPROVE_WITH_NITS`, 0 bugs** (head `90b471ce5a`, `diff_hash d2a5b8f014be`; A correctness ✅,
Devin 0/0/0, C clarity 2 non-blocking nits; never posted to GitHub — maintainers mid-decision).
**CLOSED UNMERGED** 2026-08-06T09:26:19Z by skiminki-nv ("Closing due to Yong's disapproval";
`mergedAt: null`). ⇒ **a correct fix can die on design disagreement; "closed" says nothing about
the work's quality.** The public verdict comment `5121153624` was PATCHED in place (it had gone
from true to *actively false* — "fixed in #12269" while the PR was closed and the crash live):
now records closed-unmerged, still-reproducing @`9eb90c50a`, the crash-family table, the
202c/#12296 split. ⭐ **A public comment can go true→false with no edit — the world moved;
chain-terminal is the moment to re-read your own public artifacts.**

## Disposition
- Patch revivable at branch `fix/issue-12266` @ `90b471ce5a` — fixer correctly did NOT delete
  branch/worktree, reopen, repush, or comment (closed-on-design ≠ wrong work). Queued nits
  (C001 doc-why-no-scopeDecl / FG001 arbitrary `-target hlsl` / shadowing-execution test gap /
  rebase, now `behind_by 34`) are MOOT unless revived.
- **Human comment 2026-09-15 (`5685417102`)** — skiminki-nv, no bot mention: "Marking this as
  blocked. @tangent-vector, @csyonghe, and me need to discuss the right fix." Administrative /
  confirmatory, NOT substantive ⇒ no re-open, no bot post, no dispatch. One new fact: a 3-way
  maintainer discussion now formally OWNS the live crash (tangent-vector looped in) — a small
  positive on the ownerless-crash concern escalated Aug-6. This explicit disposition is the
  non-silent close Invariant 4 requires.

**Blocker:** no maintainer consensus; a segfault is reachable from RELEASED Slang on 4 source
forms. **RESUME bar (unchanged):** a fresh *substantive* human comment on #12266 (design
decision, new repro, question-to-us) or an explicit revive request. Do NOT re-dispatch, reopen,
repush, or delete the branch.

**Durable lessons (already distilled in their own concepts):** verify regression claims at
precision after a rebase [[feedback_verify_regression_claims_at_precision]]; in-session monitors
die on teardown but the WORK may persist on disk — check artifacts before writing a run off, and
`persistent:true` is necessary-but-insufficient (use a host cron / foreground pass)
[[feedback_in_session_monitors_dont_survive_teardown]]; the shared `tmp/pr-diff.patch` clobber
between concurrent reviews (one loud INTEGRITY-FAIL false positive + one silent wrong-PR review
from a single root cause) [[project_review_pipeline_shared_tmp_diff_clobber]],
[[feedback_a_guard_can_be_inert_and_read_as_passing]]; don't restart live chains on a benign ack
[[feedback_benign_ack_loop_dont_restart_if_live_chains]]; don't close open proposals
[[feedback_dont_close_open_proposals]].

**Related (NOT dup):** #12261 (statement labels on non-breakable stmts) — same-author
language-hardening family. Feature origin PR #6619 (defer, merged 2025-04-07).
