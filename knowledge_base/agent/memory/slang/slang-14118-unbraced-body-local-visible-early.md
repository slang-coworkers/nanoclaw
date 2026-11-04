---
type: chain
description: "Bot-filed 10-31 follow-up of #14099: a local declared as an unbraced if/else/while/do body is visible before its declaration (wrong read, invalid SPIR-V, vk segfault). Owned by the #14099 chain. Approach A → draft PR #14119 (R2 APPROVE_WITH_NITS). ⛔ 11-03 maintainer skiminki-nv marked it BLOCKED on the #12266 3-way design talk; his PR #12389 (approach C, breaking) now says Fixes #14118. #14119 parked; un-draft ask withdrawn."
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
| PR | **#14119**, DRAFT, branch `fix/issue-14118`, `pr: non-breaking`, head **055a6b8c7** (11-02 comment scrub; was 787db86d2; 7 files); status comment #issuecomment-6537780783 |
| Review | R1 at ee84ee78b: REQUEST_CHANGES (small) 0/2/1/5 (`raw/combined-review-14119-r1.md`); R2 at b7046a6a0: **APPROVE_WITH_NITS 0/0/0**, 1 wording nit (applied in 787db86d2). Full suite 11355/11358 |
| CI | dispatch run 41167293498 throttled like #14115's; `pull_request` runs skipped (draft) |
| Parked | **operator: un-draft #14115 and #14119** (msg 191); same timer `recheck-14115-ready-faff` fired 11-02 17:00Z (unchanged); final re-check `recheck-14115-ready-2-3f50` 2026-11-05 17:00Z |
| Maintainer asks | whether `pr: non-breaking` is right given G2; B/C on the issue |

- **11-02 ~23:45Z:** I asked the fixer (msg 203, in_reply_to 186) to apply tangent-vector's #14115 rule ("stop adding *process* information (e.g., issue/PR numbers) as documentation in the codebase") to #14119 before its review: the `(gh-14118)` and "option B on gh-14118" comments in the tests/bugs/gh-14118* files, and any option-B cites in the do/while comments. Comment-only, no CI re-dispatch. The fixer reports back with the new head. Dashboard msg 205 lists it.
- **11-02 23:56Z: done.** #14119 head is now **055a6b8c7** (still a draft), and the explain-diff HTML was refreshed. Verified: the added lines contain 0 `gh-NNNNN`, `#NNNNN` or "option B" references.
- **Fixer correction 11-02 23:56Z:** the CUDA rows only compile the shader, so runtime results are cpu + vk only. The PR description and explanation now say so. My dashboard msg 191 relayed "cpu/vk/cuda (14/14 slots)" as the fixer's claim, so ⚠️ the next dashboard post (the re-check) should carry a one-line correction: cpu + vk runtime, cuda compile-only.

- ⛔ **11-03 13:52/13:53Z: BLOCKED by a maintainer.** skiminki-nv (the #14118 assignee) posted two comments with no bot mention. #issuecomment-6605612718: "duplicate or at least closely related to issue #12266. Its fix PR (#12389) would make code such as `if (c) int i = 1;` illegal." #issuecomment-6605641351: "Marking this as blocked", linking #12266#issuecomment-5685417102 (09-15: "@tangent-vector, @csyonghe, and me need to have a discussion on what is the right fix"). **PR #12389** "Disallow declaration substatements" (skiminki-nv, open, non-draft, `pr: breaking change`, approach C) has a body that now says `Fixes #12266` and `Fixes #14118`. Its last comment, 09-15: "Postponing … confirm with @csyonghe". The webhooks reached Main session bw7pxw (rows 16, 18). I relayed them verbatim to the fixer owner `uegnm0` and verified the message landed as seq 42. I asked for: park #14119 (no push, CI, close or reply); at most an in-place edit of status comment 6537780783 to read "blocked on the #12266 discussion"; a 5-bullet back. **The operator un-draft ask for #14119 (msg 191) is withdrawn.** The 11-05 re-check `recheck-14115-ready-2-3f50` now covers #14115 only. #14120 ("parked until #14119 lands") is probably also covered by #12389's ban on declaration substatements; that is unverified. **Resume if:** a substantive human comment lands on #14118, #14119 or #12266; #12389 merges or closes; or someone asks for a revival.
- **11-03 13:59Z fixer [Report]: parked.** Verified: status comment 6537780783 edited in place at 13:59:07Z ("Parked … blocked on the maintainer discussion in #12266"), with no new comment; #14119 is still an OPEN draft at 055a6b8c7. The chain is idle until the resume bar above is met.

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
