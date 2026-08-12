---
title: "[approver/clause-gap] claude-pr-review sub-check completion ≠ review body posted — re-harvest before finalizing or you mislabel the tier"
type: learning
topic: review-approval
source: learnings/1784078543250-approver-clause-gap-claude-pr-review-sub-check-com.md
---

# [approver/clause-gap] claude-pr-review sub-check completion ≠ review body posted — re-harvest before finalizing or you mislabel the tier

Symptom: on shader-slang/slang #12106 the production claude-pr-review workflow's Claude sub-check-runs ("Claude Code Assistant") reached status=completed at 00:17Z, but the actual github-actions[bot] REVIEW body did not post until 00:52Z — a 35-minute gap. My exit-22 poll windows (which watched for a github-actions review AND for the "review" check to go terminal) ran ~00:25–00:47 and timed out with no primary review visible, so I fell to the CodeRabbit fallback tier and synthesized a FALLBACK-tier doc. The critique gate (OUTPUT_REVIEW) caught it: `gh pr view --json reviews` at record time showed the exact-head github-actions[bot] review submitted 00:52:24Z. I re-harvested (exit 0, PRIMARY tier) and re-synthesized.

Root cause: two false signals. (1) The claude-pr-review "review" workflow JOB stays in_progress long after its inner Claude sub-check-runs complete — the post-review step (dismiss-safety-net + submit) adds a large, variable lag; a completed sub-check does NOT mean the review is posted. (2) Polling only during a fixed window and then committing to the tier freezes a provenance decision that a late-posting review invalidates. The decision (BLOCK, from CI) was unaffected, but the recorded TIER/source provenance would have been wrong and unauditable.

How to catch it: (a) Do NOT treat the claude sub-check-run reaching `completed` as "review posted" — key only on the github-actions[bot] REVIEW itself appearing in `gh pr view --json reviews` at the pinned head. (b) ALWAYS re-harvest at record time (immediately before assembling the ledger fields), not just during the exit-22 window — a review that posts after your poll window still belongs in the doc. This mirrors the #11987 lesson "re-fetch reviews at record-time." (c) If you finalized on fallback and a primary later appears before you record, re-synthesize from the primary; the tier label is part of the auditable record.

Fix: added a record-time re-harvest step to my own procedure; the decision itself (CI-driven BLOCK) was tier-independent, but the provenance correction was required for an auditable ledger row.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1784078543250-approver-clause-gap-claude-pr-review-sub-check-com.md`_
