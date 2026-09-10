---
name: project_slangpy_1063_profiler_selfmerge_latent_findings
description: "slangpy#1063 Profiler MERGED 07-13; 6718-line core C++; 2 unresolved CodeRabbit Major findings shipped"
metadata: 
  node_type: memory
  type: project
  originSessionId: f4c4638b-8c65-4137-8106-9c6d630009e2
---

slangpy#1063 "Profiler" (skallweitNV) — new profiler subsystem, ~6718-line core C++ (`src/sgl/utils/profiler.*` + bindings/examples/docs/tests). **Author self-merged 07-13** at head `06912033bb49`, merge commit `dac9e0e3df1a`, with `reviewDecision=REVIEW_REQUIRED` (no independent approving review — only human review, ccummingsNV's, was DISMISSED).

**Latent risk shipped unresolved:** CodeRabbit flagged **2 🟠 Major** in `profiler.cpp`, never resolved by a later commit:
1. Stale cached GPU-recording pointer → potential **use-after-free**.
2. `end_zone()` LIFO mismatch → encoder-state desync.

These were unverified bot flags (incremental-delta view), never challenger-verified. If a future slangpy profiler crash/UAF surfaces, start here.

**Approval-chain outcome:** slangpy-pr-approver recorded 5 ledger rows R0–R4, all **ABSTAIN_POLICY / CLAUSE_FAIL:tier_eligible** (diff ~3.3× over the 2000-line cap on every revision — size cap is a terminal Step-1 clause that short-circuits before verdict/challenger). `[DO NOT MERGE]` title marker was present R0–R3, dropped at R4. Not a false-safe: approver never said WOULD_APPROVE; cap correctly deferred to a human. R4 row stamped human_verdict=APPROVED-equivalent on merge. Related: [[feedback_approver_never_posts_route_reviewer]], [[feedback_nv_coworkers_automerge]].
