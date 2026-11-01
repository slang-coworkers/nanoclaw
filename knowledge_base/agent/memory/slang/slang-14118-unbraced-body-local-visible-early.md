---
type: chain
description: "Bot-filed 10-31 follow-up of #14099: a local declared as an unbraced if/else/while/do body is visible before its declaration (wrong read, invalid SPIR-V, vk segfault). Owned by the #14099 chain. Approach A → draft PR #14119, R2 APPROVE_WITH_NITS at 787db86d2; PARKED on the operator un-draft (dashboard msg 191)."
tags: [scoping, frontend, side-find, ready-flip]
resource: raw/triage-14118.md
---

# shader-slang/slang#14118 — unbraced-body local visible before its declaration

Spawned by [[slang-14099-hlsl-sibling-for-loop-redecl.md]]; its own follow-up is
[[slang-14120-target-switch-catch-for-local-visible-early.md]].

## State (10-31 04:20Z)

| | |
|---|---|
| Issue | filed 10-31 00:52:12Z by nv-slang-bot (triager session u9zfkk); `reproduced`, Type=Bug, medium/P2; triage comment #issuecomment-6536781331 (edited 00:55Z to "handed to fixer"). Bot-filed → no R6 hold |
| Ownership | ⛔ **owned by the #14099 chain** — triager `sess-1793389741238-u9zfkk` (thread `gh-issue-shader-slang/slang-14099`); fixer `sess-1793408053307-uegnm0` on `gh-issue-shader-slang/slang-14118` (exactly one). The webhook's fresh Main session (bw7pxw) correctly dispatched nothing |
| PR | **#14119**, DRAFT, branch `fix/issue-14118`, `pr: non-breaking`, head **787db86d2** (7 files +385/−40); status comment #issuecomment-6537780783 |
| Review | R1 at ee84ee78b: REQUEST_CHANGES (small) 0/2/1/5 (`raw/combined-review-14119-r1.md`); R2 at b7046a6a0: **APPROVE_WITH_NITS 0/0/0**, 1 wording nit (applied in 787db86d2). Full suite 11355/11358 |
| CI | dispatch run 41167293498 throttled like #14115's; `pull_request` runs skipped (draft) |
| Parked | **operator: un-draft #14115 and #14119** (msg 191); same timer `recheck-14115-ready-faff` 2026-11-02 17:00Z |
| Maintainer asks | whether `pr: non-breaking` is right given G2; B/C on the issue |

## Fix and review findings

- Repro (Slang mode): `{ value = i; if (c) int i = 1; }` reads an undeclared variable; CPU `f(7,true)`
  returns 0 (expected 7); SPIR-V has a Function-storage var at module scope; Vulkan segfaults. Same
  `visitBlockStmt` direct-child-only hiding gap as #14099; fails on v2025.18.2 too. Not a dup of
  #13752/#13720/#13435.
- Approaches: **A** (taken) `visitBlockStmt` hides every local `stmt->scopeDecl` owns; B implicit C++
  scope for unbraced bodies; C reject the declaration (B and C are language decisions).
- R1 **G1**: `if (let …) … else int i = 1;` still failed — `parseIfLetStatement` (slang-parser.cpp:7677)
  returned a plain SeqStmt; remedy (+56/−4) wraps it in a BlockStmt (adds a DebugLexicalBlock, so
  `tests/spirv/debug-lexical-scope-if-let.slang` CHECKs changed). Applied verbatim.
- R1 **G2**: a `for` side-effect expression reading the body local silently changes value (100 on
  base, 7 on head); disclosed on the Risk line; the variant with no outer name now gets E30015.
- R1 Q1: `doPredicateAfterBody` comments reworded as current behavior.
- Extra test: single-statement block `{ int v = m, m = 1; }` (E30015 with the fix) in
  `gh-14118-diagnostic.slang`.
- "Not covered" (Risk line): `__target_switch` case, unbraced `catch`/`$for` bodies → filed as #14120.
  Generated docs `docs/generated/design/name-resolution/lookup.md` and `scopes.md` are stale and are
  left to the design-docs loop (it has a human-run review stage), not hand-edited.
