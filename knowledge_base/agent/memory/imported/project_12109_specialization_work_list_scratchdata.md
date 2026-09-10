---
name: project_12109_specialization_work_list_scratchdata
description: "#12109 SpecializationWorkList via IRInst::scratchData — WOULD_APPROVE CLEAN; human owns merge"
metadata: 
  node_type: memory
  type: project
  originSessionId: 27b1e907-e0f9-46c9-911c-7a4b2f80c0e2
---

**TERMINAL 2026-07-17:** PR closed UNMERGED by the AUTHOR (pdeayton-nv, 04:15Z) — "larger refactoring around specialization in the future that will obsolete this." NOT a defect rejection ⇒ strategic direction-change, NOT a false-safe (same class as [[project_11323_casttovoid_closed_wronglayer]] "fix producer later"). Approver joined human verdict onto R1 ledger row via record_human_verdict = CLOSED_UNMERGED_AUTHOR_OBSOLETE. ZERO human reviews ever existed (all 4 timeline "reviewed" events were bots; reviewDecision stayed REVIEW_REQUIRED). R1 WOULD_APPROVE stands vindicated on correctness.

**R2 (synchronize @7cb3c61b):** never recorded a decision (correctly). Only delta from R1 = 57-line DELETION of the serialization-DEFER end-to-end test `irSerializationClearsScratchData` (compiler source byte-identical) — a coverage regression on the load-bearing anti-leak invariant. Session torn down while waiting for R2 primary review (posted 07-16 09:12Z); PR closed before R2 decided.

shader-slang/slang PR #12109 "Add SpecializationWorkList using IRInst::scratchData" (author pdeayton-nv, head 00bdbc629f9b). slang-pr-approver verdict **WOULD_APPROVE (CLEAN)** @ 00bdbc62, recorded to approval_decisions ledger (shadow/ledger-only — nothing posted to GitHub; routed to approver only, no reviewer in loop).

**Why:** primary claude-code-action review (non-stale @ pinned head) = APPROVE_WITH_NITS, 0🔴 / 4🟡 (clarity/contract/coverage). Devin head-current 0 bugs/0 flags/4 info; CodeRabbit 4 maintainability nits. All 6 clauses pass (v0-shadow-relaxed). Challenger verified vs source: scratchData bit-2 marker doesn't collide with legalize/autodiff bits 0/1; work list fully drained before every whole-word scratchData consumer (both eliminateDeadCode at round boundary after drain; pop()/clear() clear the bit); serialization SLANG_DEFER zeroes exactly the insts it wrote; Devin's "clear() UAF" not reachable (IRInsts arena-allocated, removeAndDeallocate never frees).

**How to apply:** await human merge — no follow-up from us unless a substantive comment/webhook re-opens the chain. Two CI reds are proven infra flakes (windows-release-gpu test-server `waitForResult()` JSON-RPC dropout; sanitizer-linux `ld DWARF FORM 0x23` binutils/DWARF5 link error) — built on 9/9 other configs; policy doesn't require CI green. See [[feedback_approver_never_posts_route_reviewer]].
