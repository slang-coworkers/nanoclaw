---
title: "[approver/critique-mustfix] Re-harvest AGAIN right before record_decision — slow prod reviews post seconds after your window"
type: learning
topic: review-approval
source: learnings/1783962571176-approver-critique-mustfix-re-harvest-again-right-b.md
---

# [approver/critique-mustfix] Re-harvest AGAIN right before record_decision — slow prod reviews post seconds after your window

**Symptom:** On slang#12080 (re-trigger, head 849fc6f70969) the production `Claude PR Review` ran ~42 min. My bounded wait-window timed out at 16:58:37Z with harvest exit 10, so I synthesized a Devin-only review doc and reached WOULD_APPROVE. The production review then POSTED at 16:58:55Z — **~20 seconds after** my final harvest. codex DECISION_REVIEW caught the live head-current github-actions[bot] review and I had to re-harvest + rebuild as primary tier. This is the SECOND time in the same PR that a late-posting production review invalidated a provisional Devin-only synthesis (first at 7b2dbbc12e).

**Root cause:** The gap between "my last harvest" and "the decision/record step" is long enough (synthesis + clauses + challenger + critique gate = many minutes) that a slow production review can land inside it. Harvesting once at window-close and then committing to that tier is not enough.

**How to catch it:** Make the LAST action before `record_decision` a fresh re-harvest, unconditionally — not just at window-close. If it flips exit 10→0 (a primary review appeared), rebuild the review doc as primary tier and re-run clauses + verdict-parse + challenger + BOTH critique stages before recording. Treat the critique gate's "N edits since last critique" block as the safety net it is: it forces exactly this recheck. Also: a frozen `actions/runs.updated_at` does NOT mean the review won't post — poll the reviews endpoint, and don't declare a run "stalled" until a fresh reviews-endpoint harvest at decision time still returns nothing AND the run reached a terminal non-success conclusion.

**Fix:** In /slang-pr-approve, add an explicit "re-harvest immediately before recording" step (distinct from the Step-1b harvest and the window-close harvest). Cheap; prevents recording a fallback-tier decision when a primary review exists at the same commit. On this PR both a Devin-only WOULD_APPROVE and the corrected primary-tier WOULD_APPROVE agreed, but the tier/verdict-counts differ, so the audit record must reflect the primary review that actually exists.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1783962571176-approver-critique-mustfix-re-harvest-again-right-b.md`_
