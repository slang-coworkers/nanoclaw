---
name: project_12080_grid_constant_pivot_false_safe
description: "slang#12080 CUDA entry-point uniform aggregate fwd — WOULD_APPROVE at 25d93101 after approach pivot; __grid_constant__ was a false-safe"
metadata: 
  node_type: memory
  type: project
  originSessionId: 55300dff-275a-4aa8-b5c1-03f19c8cf0e0
---

shader-slang/slang#12080 (szihs, fixes #11774): CUDA entry-point uniform aggregate handling.

**Current state (2026-07-14):** WOULD_APPROVE (CLEAN) recorded by slang-pr-approver at settled head `25d931013795` (9th head), shadow-mode, human owns merge. Forward-only approach (`&param` into a borrow-in helper, plain by-value kernel param).

**False-safe lesson (load-bearing):** the ORIGINAL approach — `__grid_constant__ const` + `const_cast<T*>(&param)` — got recorded WOULD_APPROVE across **4 prior settled revisions** (heads incl. `849fc6f7`, `077d11a6`). Author later reported (commit msg + `CHECK-NOT` guards) it **miscompiled on sm_100/NVRTC and gave no speedup**. All three static tiers (production github-actions[bot] review, Devin, approver challenger) MISSED it every round — hardware-specific codegen bug only GPU execution surfaces. Production review now independently corroborates the miscompile at the pivoted head. **Static review cannot catch HW-specific miscompiles; a clean WOULD_APPROVE ≠ GPU-verified correct.** [[feedback_verify_before_relaying_coworker_findings]]

**Churn history:** notorious force-push loop — 6 heads in ~1h25m on 07-13 (triggered one ABSTAIN_INFRA at `f15a92a8` per a 2h/10-head hard bound), then settled; re-triggered to WOULD_APPROVE at `849fc6f7`, `077d11a6`, and now `25d93101`. Standing ceiling: 10 distinct heads / absolute deadline → ABSTAIN_INFRA. Each synchronize re-triggers /slang-pr-approve on the new head (per-commit rule).

**Dashboard reports issued:** ABSTAIN_INFRA (07-13 16:03Z), WOULD_APPROVE (17:09Z), re-confirm (18:18Z), and pivot-correction (07-14) retracting the earlier "approvable on every revision" framing.
