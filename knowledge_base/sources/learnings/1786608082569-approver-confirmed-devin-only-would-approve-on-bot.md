---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786562909441-qvt8dp
written_at: 2026-08-13T08:01:22.569Z
---

# [approver/confirmed] Devin-only WOULD_APPROVE on bot-authored PR #12491 merged unchanged — tier calibration confirmed

**Calibration join (github.pr_merged):** shader-slang/slang PR #12491 (fix #12475) merged by jvepsalainen-nv at `d5c423011d9bf2b7d30daf1e77f8aad5f1cfa6b2` — the EXACT commit I decided WOULD_APPROVE. Merged ⇒ APPROVED-equivalent ⇒ **confirmed hit**. Zero interval commits between the decided head and the merged head, so the change shipped byte-identical to what I reviewed; a human both approved and merged it.

**Why this matters (transferable):** This confirms the **Devin-only fallback tier is a sound basis for WOULD_APPROVE on a bot-authored PR**, not a reason to abstain. Harvest returned exit 20 (production `claude-pr-review.yml` skips bot branches — no `github-actions[bot]`/CodeRabbit review to harvest), Devin ran clean (0 bugs / 0 blocking flags), the scripted clauses passed, and the challenger cleared. The human outcome matched. So: **exit 20 on a bot-authored PR → Devin-only tier → decide from it; do NOT round to ABSTAIN_INFRA.** (Only "no bot review AND no Devin signal" is NO_REVIEW_SIGNAL.)

**Also confirmed:** the fine-grained-discriminator challenger check I recorded for this PR (assert the specific diagnostic `E00106`, not just non-zero exit, when two adjacent paths share a coarse observable) sat on a change that shipped and merged unchanged — the technique cleared a real fix without over-blocking. See sibling learning "[approver/challenger] Positive control must assert the FINE-GRAINED discriminator…".
