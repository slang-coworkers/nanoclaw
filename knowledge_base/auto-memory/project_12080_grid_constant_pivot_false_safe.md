---
name: project_12080_grid_constant_pivot_false_safe
description: "slang#12080 CUDA entry-point uniform aggregate fwd — WOULD_APPROVE at 25d93101 after approach pivot; __grid_constant__ was a false-safe"
metadata: 
  node_type: memory
  type: project
  originSessionId: 55300dff-275a-4aa8-b5c1-03f19c8cf0e0
---

shader-slang/slang#12080 (szihs, fixes #11774): CUDA entry-point uniform aggregate handling.

**Current state (2026-07-16):** RE-ARMED — a Jul-16 synchronize (head `f3b288723340`, rebased/squashed, `diverged` from 25d93101) is a REAL codegen change on the forward-only emit path: `emitGetAddress(getPtrType(arg->getFullType()),arg)` → `getDataType()`, and the `SLANG_ASSERT(getFullType()==getDataType())` guard REMOVED. Approver caught it via a true two-dot **content** diff (gh compare was merge-base-contaminated by the ahead-1/behind-1 divergence) — the codegen-inert guardrail below working as designed; approver did NOT self-certify "looks equivalent" (exactly where the false-safe lived). Full gated procedure running at f3b2887; NEW ledger row (not supersede-in-place); mode=live (author left only self-COMMENTED reviews). Verdict pending.

**Prior settled decision (07-14):** WOULD_APPROVE (CLEAN) recorded at head `25d931013795` (9th head), shadow-mode, human owns merge. Forward-only approach (`&param` into a borrow-in helper, plain by-value kernel param). Heads `aba13249 → c7f87b4b → 300cae → 4c9174b8` were all verified codegen-inert nit-polish riding that decision.

**Standing rule for #12080 (orchestrator ruling 07-14):** the 10-head ceiling is CHURN-VELOCITY-scoped, not a cumulative cap — a head holding through the quiet window is decidable regardless of ordinal. Re-run the FULL procedure only when the **codegen** (emit/IR-lowering) changes; a doc/test/comment/assert-only synchronize gets a lightweight codegen-inert check and rides the standing decision. **Guardrail:** the inert check is load-bearing — a "doc-only"-labeled push that touches emit/lowering IS a codegen change and must re-gate (this is where the __grid_constant__ false-safe lived).

**False-safe lesson (load-bearing):** the ORIGINAL approach — `__grid_constant__ const` + `const_cast<T*>(&param)` — got recorded WOULD_APPROVE across **4 prior settled revisions** (heads incl. `849fc6f7`, `077d11a6`). Author later reported (commit msg + `CHECK-NOT` guards) it **miscompiled on sm_100/NVRTC and gave no speedup**. All three static tiers (production github-actions[bot] review, Devin, approver challenger) MISSED it every round — hardware-specific codegen bug only GPU execution surfaces. Production review now independently corroborates the miscompile at the pivoted head. **Static review cannot catch HW-specific miscompiles; a clean WOULD_APPROVE ≠ GPU-verified correct.** [[feedback_verify_before_relaying_coworker_findings]]

**Churn history:** notorious force-push loop — 6 heads in ~1h25m on 07-13 (triggered one ABSTAIN_INFRA at `f15a92a8` per a 2h/10-head hard bound), then settled; re-triggered to WOULD_APPROVE at `849fc6f7`, `077d11a6`, and now `25d93101`. Standing ceiling: 10 distinct heads / absolute deadline → ABSTAIN_INFRA. Each synchronize re-triggers /slang-pr-approve on the new head (per-commit rule).

**Dashboard reports issued:** ABSTAIN_INFRA (07-13 16:03Z), WOULD_APPROVE (17:09Z), re-confirm (18:18Z), and pivot-correction (07-14) retracting the earlier "approvable on every revision" framing.
