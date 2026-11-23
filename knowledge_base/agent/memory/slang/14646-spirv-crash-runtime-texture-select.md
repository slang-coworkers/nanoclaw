---
type: chain
title: slang#14646 — SPIR-V crash: runtime-selected texture + uninitialized texture arg (use-after-free in call-specialization clone)
description: Human-filed 11-19 by pdeayton-nv; triaged to a UAF root cause and handed to slang-fixer same day
---

# slang#14646 — SPIR-V compile crash (runtime texture select × undef arg)

- **Filed:** 2026-11-19 22:02Z by pdeayton-nv (human; self-assigned — not a stand-down). No labels at intake;
  R6 dispatch at once → slang-triager 22:04Z, 👀 posted.
- **Triage (22:39Z, triager sess-1795125816864-ch0sz7):** reproduced on master 2aeded1fd (Release+Debug),
  SIGSEGV at `-target spirv-asm` all opt levels. Bug / severity high / P2 (P1 only if bisect confirms regression —
  suspected via #14342/#14358 but reporter's v2026.22.1 predates; unconfirmed). Issue comment 7024208636;
  `reproduced` + Issue Type Bug applied.
- **Root cause (triager, high confidence — verify receipts before relaying as fact):** use-after-free.
  Select-sinking appends the merge block at the END of the block list (list order ≠ dominance order,
  `emitIfElseWithBlocks` slang-ir.cpp:6554-6575, used by slang-ir-legalize-…/specialize-resource-selections
  :1458-1466). `eliminateUndefinedOpaqueHandles` clones `f(undef)`; the cloner
  (slang-ir-clone.cpp:23-49) walks blocks in list order, misses the cross-block def (`w = gMode*3`) in the
  clone env, and `findCloneForOperand` falls back to the ORIGINAL function's instruction;
  `specializeCall` (slang-ir-specialize-function-call.cpp:419-424/1141) then deallocates the original `f`,
  leaving the clone with a dangling operand → segfault in SPIR-V emit. Trigger needs all three:
  uninitialized Texture2D arg + runtime select between texture globals + merge-block value used in a later
  block; each alone compiles (5 control variants verified).
- **Solution space:** (A) cloner hardening — fallback only for module-scoped insts + assert; (B) producer —
  emitIfElseWithBlocks inserts merge block adjacent to split block, restoring dominance order; (C) two-phase
  clone. Triager recommends B + thin A. (Per repo methodology, B is the producer-side fix.)
- **Fixer:** handed off 22:40Z; slang-fixer session sess-1795128020955-5iui8o LIVE on canonical thread
  `gh-issue-shader-slang/slang-14646`. HARD RULE applies to all artifacts: never write "as in C++" or any
  C++/HLSL-comparison phrasing in code comments, PR description, commits, issue comments (fired 11-19, #14627).
- **Fix progress:** worktree wt-slang-14646 built 22:56Z (slangc+slang-test Debug, master 2aeded1fd).
  **Draft PR #14649 opened 00:26Z 11-20** @ head `68db33992` (branch `fix/issue-14646`, 2 commits:
  failing repro test → producer fix, +13/−4 in slang-ir-specialize-resource-selections.cpp — `emitConsumer`
  inserts dispatch arms+merge adjacent to the split block instead of append-at-list-end). Repro validates
  (SLANG_RUN_SPIRV_VALIDATION=1, only E41016 — no E56003). Suites: repro 2/2 (fails unpatched E40007),
  resource-selection 157/157, diagnostics 100%, full 12384/12402 (18 failures pre-existing infra).
  Issue comment 7026508762. HTML explanation: raw/2026-11-20-pr14649-spirv-crash-resource-select.html.
- **Thin-A outcome (00:36Z):** the triager's recommended cloner assert was implemented, proven by revert
  drill, then **DROPPED** — it fires on all 39 tests/autodiff-dstdlib/* (legitimate cross-function clone
  reuse, indistinguishable at clone time). Cloner hardening filed separately by the fixer as **slang#14651**
  (bot-filed, open, carries verification results → our own Terminal filing: **do NOT dispatch a triage
  chain on its issue_opened**). Per the handoff's explicit fallback, B-alone ships in #14649.
- **Review:** all three critique stages approve (PLAN/CODE/OUTPUT_REVIEW); slang-reviewer R1
  REQUEST_CHANGES (2 test-hardening gaps) → applied; R2 APPROVE_WITH_NITS (1 coverage gap + 4 comment
  questions) → applied, no further round. CODE_REVIEW caught misspelled `[notinline]` → `[noinline]` (E31000).
- **TERMINAL our side 00:36→03:38Z 11-20:** final [Fix Report] in. PR #14649 @ head `c9e450ca7`, 2 files
  +189/−4 (pass fix with documented contract + debug assert; 5 regression variants in
  tests/spirv/resource-selection-uninitialized-param.slang). Suites: repro 5/5, resource-selection 160/160,
  opaque-handle diagnostics 100%, full 12384/12402 (18 failures pre-existing infra; 13 stale std-module —
  regenerated, functional re-verified 14/14). Light checks green 6/6; full CI matrix run 44667087438 queued.
  Codex confirmed 6 emitted modules pass spirv-val directly (container's SLANG_RUN_SPIRV_VALIDATION is a
  silent no-op — no spirv-val on PATH). **Draft flipped ready-for-review by the REPORTER pdeayton-nv
  (not the fixer — spine intact), who also requested review**; explanation comment 7026260576.
- **Next:** maintainer review + merge of #14649; follow-up slang#14651 (cloner hardening) for a human
  to triage. **04:17Z 11-20: APPROVED by maintainer pdeayton-nv** (review 5987411008, empty body; issue
  status comment 7028424926 updated in place). CI matrix run 44667087438 still queued at head
  `c9e450ca7`; merge pending — maintainer's move. Webhook-driven on #14649.
- **✅ TERMINAL 10:43Z 11-20 — MERGED:** PR #14649 merged (squashed) by pdeayton-nv at `c9e450ca7`;
  issue #14646 auto-closed via Fixes reference; final [Resolution] comment 7028424926. Worktree
  wt-slang-14646 removed, sentinel deleted. **Chain complete in <13 h** (filed 22:02Z → merged 10:43Z).
  Follow-up slang#14651 (cloner hardening + autodiff cross-function reuse classification) open for human
  triage — bot-filed, do not dispatch on its issue_opened. Nothing in flight.
- **Next:** reviewer verdict → [Fix Report] → ready-flip pending human review.
- **Follow-up filed 11-20 (#14651):** the fix chain filed a bot-authored hardening issue on the cloner's
  `findCloneForOperand` fallback (classify autodiff cross-function reuse; also flag
  `emitIfElseWithBlocks` end-of-list block append). PR #14649 kept the producer-side fix only, so
  #14651 tracks the consumer-side hardening. Filed-only disposition (own chain's terminal filing,
  verification results in body) — no triage chain dispatched. A future fix chain on it is a fan-out:
  report to operator first per filing policy.

# Citations
- Raw triage memo (repro variants, per-pass dump bisect, approaches A/B/C with risks, acceptance
  criteria): [raw/triage-14646.md](raw/triage-14646.md) (2026-11-19).
- Triager's deeper research memo lives in ITS group store: `memory/issues/triage-14646-clone-forward-ref-research.md` (slang-triager).
