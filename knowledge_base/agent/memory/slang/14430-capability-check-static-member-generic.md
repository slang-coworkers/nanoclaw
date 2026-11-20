---
type: chain
title: slang#14430 — capability check misses `[require]` of a static member called through a generic type
description: Backlog released 2026-11-17 (operator correction retired assignee-only holds). Chain active — triager reproduced+labeled 03:19Z, fixer fix DONE+verified on fix/issue-14430 @ da7739124, PR creation + codex-critique gates in flight after provider-flap recovery; recheck one-shot armed 11:05Z.
tags: [capabilities, semantic-check, require, generics, static-member, active-chain]
---

# slang#14430 — `S<float>.SF()` skips the `[require]` check

**Ask.** A static member of a generic struct (`S<float>.SF()`, `[require(spirv)]`) compiles for `-target hlsl`
with exit 0; non-generic static, generic free fn, plain free fn and instance method all error E36107. Core-module
case: `linalg.CoopMat<...>.GetLength()` on Metal (the `-DTEST_GETLENGTH` line of `metal-unsupported.slang`).
Root cause (author's, triager-verified on-disk): `SemanticsDeclReferenceVisitor` (`slang-check-decl.cpp`) —
member decl-ref is not direct, `visitVal` walks only Val operands, and `visitStaticMemberExpr` lacks the
`processDeclModifiers` call that `visitDeclRefExpr` has. Full fix also needs `*.meta.slang` `[require]`
corrections (naive fix breaks the core module: coopVecLoad* missing `optix_coopvec`).

**11-10:** filed by jkwak-work (self-assigned); I held it — **that hold was an error**: the 11-17 operator
correction retired assignee-only holds (R6, [imported/project_13591_ai_contributor_standards_batch.md](../imported/project_13591_ai_contributor_standards_batch.md)).
**11-17:** backlog released 03:11Z; triager chain (sess-1794885067406-s0nrj0) reproduced on master, `reproduced`
label, memo + handoff to fixer; fixer owner session **sess-1794885540453-7mgxdt** (canonical thread
`gh-issue-shader-slang/slang-14430`).

**11-17 chain state (as of 10:15Z):**
- Provider 429/flap storm 05:15–08:48Z killed several fixer turns with the canned "Sorry, something went
  wrong" bounce; brief recovery 08:52Z (real status: fix DONE, suite green), then the gate-run turn died 08:58Z.
- Fix **DONE + verified** on branch `fix/issue-14430` @ `da7739124` (master merged 07:48Z; acceptance criteria
  met, full suite 12319/12322 with 3 known-env). NO PR open yet at 10:05Z. Issue comment 6937055487 ("fix
  incoming") still accurate.
- 10:09Z: I re-woke the fixer (pinned send, owner session seq 16) — resume PR creation + three codex-critique
  gates + report_pr_created + comment update. No bounce in the first 5 min (fast-fail signature absent).
- Follow-up one-shot armed: `recheck-14430-pr-created-7520`, fires 11:05Z (decision table in its prompt).
- Provider health ruling by sibling Main 10:08Z: bounce window clear >60 min, chains completing end-to-end.

**Routing lesson (verified in nanoclaw source this run):** `resolveExplicitReplyTarget` filters Layer-1
candidates by `candidate.agent_group_id !== targetAgentGroupId` (agent-route.ts:294) — so in a cross-group
pin (my task inbound from slang-triager, send `to: slang-fixer` + `target_session_id`), the auto-stamped
triager-row in_reply_to resolves to null and the pin WINS. The recorded in_reply_to-beats-pin failures were
all same-group sibling sends. Pin + thread_id + verify delivery worked first try (no phantom minted).
