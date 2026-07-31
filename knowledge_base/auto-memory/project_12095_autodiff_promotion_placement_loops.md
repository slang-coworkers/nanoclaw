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

**✅ MERGED-VINDICATED 07-30 18:41Z (approver join-scored, id 78460).** `github.pr_merged` join → Step 4 (human-verdict capture). **The ABSTAIN was VINDICATED — join-SHA-first check was the standing rule that mattered.**
- PR merged but **NOT at my decision head:** head moved `485ba73b` → `ede2eab8` before merge.
- Sole substantive delta = **one commit "Preserve SSA when promoting autodiff operands"** (26+/49− in `slang-ir-autodiff-transpose.cpp`, fn `promoteOperandsToTargetType` — exactly challenger concern #1's file/fn). That commit **deleted the reconstructed-`newInst` path** the CodeRabbit 🔴 (cross-block SSA-dominance) flagged; its comment states the violated invariant verbatim → **concern #1 was a REAL defect, not the false-positive the challenger leaned toward.**
- `kaizhangNV` APPROVED **only** the revised head `ede2eab8`; nobody approved `485ba73b`; saipraveenb25 self-merged the revised head. Concern #2 (CPU segfault) already confirmed flaky.
- **Scoring:** `record_human_verdict(485ba73b)=CHANGES_REQUESTED` — flagged code changed before earning approval. WOULD_APPROVE at pinned head would've been a **false-safe**. Directional agreement, do-not-round-up class.
- **2 learnings written** (shared): (1) `[approver/human-agreement]` unproven-🔴-fixed-before-merge; join-SHA-first prevented mis-scoring a vindication as agreement-on-a-different-artifact. (2) `[approver/challenger-miss]` — challenger's "throwaway container/deleted-later ⇒ benign" lean on a transient-invalid-SSA 🔴 was WRONG; "bad shape is cleaned up" ≠ safety proof for SSA dominance violation. What saved it = the POLICY of holding ABSTAIN on an unrefuted plausible 🔴, not the challenger's read.
- No GitHub writes (shadow). **TERMINAL** — ledger + learnings durable.
