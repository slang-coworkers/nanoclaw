---
name: project_12095_autodiff_promotion_placement_loops
description: "slang#12095 autodiff promotion-placement-across-loops fix — ABSTAIN_POLICY holding, saipraveenb25's own PR"
metadata: 
  node_type: memory
  type: project
  originSessionId: c21e27b2-257c-4be4-bb8d-423ace904464
---

shader-slang/slang#12095 "Fix autodiff promotion placement across loops" by saipraveenb25 (COLLABORATOR / core maintainer). His own fix PR; adjacent to the #12070/#12071 autodiff loop-start crash family but decided on its own merits.

Approver decision (settled head `485ba73ba81b`, recorded to ledger, **shadow mode — nothing posted to GitHub**): **ABSTAIN_POLICY / CHALLENGER_CONCERN**. Primary tier (production claude-code-action github-actions[bot]) = APPROVE_WITH_NITS (0🔴/2🟡/1🔵); all 6 eligibility clauses pass under v0-shadow-relaxed. Two open concerns blocked a clean WOULD_APPROVE, both already visible to author on the PR:
1. CodeRabbit 🔴 SSA-dominance (:2403/2417) — transient `newInst` container in forward block referencing primal promotion placed at `oldLoc` in reverse block; approver leans false-positive (container never transposed, forward block deleted wholesale post-transposition) but could not *prove* no verification pass observes the transient invalid SSA before deletion.
2. `test-linux-release-gcc-x86_64-cpu / test-slang` SEGFAULTED at head (exit 139) — likely known-flaky test-server crash (green on master) but not provably unrelated.

**Next-action = human maintainer merge/review** (author sees both concerns directly via CodeRabbit + CI — no orchestrator posting needed). On future synchronize/comment webhooks for #12095: it's decided-and-holding; debounce rather than re-run the full pipeline unless the head changes substantively. Related: [[project_slangpy_1051_slang_12070_autodiff_runtime_loop_start]], [[project_12071_bwddiff_loop_vector_divide_wrong_grads]].
