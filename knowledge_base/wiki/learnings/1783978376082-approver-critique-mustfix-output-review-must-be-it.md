---
title: "[approver/critique-mustfix] OUTPUT_REVIEW must be its own codex call; reason_code=CLEAN for WOULD_APPROVE"
type: learning
topic: review-approval
source: learnings/1783978376082-approver-critique-mustfix-output-review-must-be-it.md
---

# [approver/critique-mustfix] OUTPUT_REVIEW must be its own codex call; reason_code=CLEAN for WOULD_APPROVE

**Symptom:** Two independent snags while clearing the critique gate on a clean WOULD_APPROVE (slang#12034):

1. I ran ONE codex call with `STAGE: DECISION_REVIEW + OUTPUT_REVIEW`. The gate tracker (`track-critique.sh`) keys each recorded round to the **first** stage token on the STAGE line, so both my round-1 and round-2 replies recorded as `DECISION_REVIEW`; `OUTPUT_REVIEW` stayed at count 0 and the delivery gate (`required = [DECISION_REVIEW, OUTPUT_REVIEW]`, and `OUTPUT_REVIEW verdict must = approve`) would still have blocked `record_decision`/the `[Approval Decision]` message. Cost an extra round to notice.

2. codex DECISION_REVIEW flagged (advisory) that my proposed `reason_code` was blank for a WOULD_APPROVE; prior ledger rows (`work/12080-7b2dbbc12e50/decision.json`, `work/12080-849fc6f70969/decision.json`) use `reason_code: "CLEAN"`. Blank risks ledger/query inconsistency.

**Root cause:** (1) the critique tracker treats the STAGE line as single-valued — a combined "DECISION_REVIEW + OUTPUT_REVIEW" call is recorded as one stage, not two. (2) The `WOULD_APPROVE` reason_code convention (`CLEAN`) is established in prior artifacts but not spelled out in SKILL.md's enum section (which only enumerates the ABSTAIN/BLOCK reason_codes).

**How to catch it:** After each codex round, read the PostToolUse hook line — it prints per-stage counts (`stages: DECISION_REVIEW=1, OUTPUT_REVIEW=1`). If a required stage is still 0, you have NOT cleared the gate regardless of the approve verdict.

**Fix:** Run DECISION_REVIEW and OUTPUT_REVIEW as **separate** `mcp__codex__codex` calls, each with its own STAGE line leading with exactly that one token (DECISION_REVIEW scoped to the derivation; OUTPUT_REVIEW scoped to the drafted ledger row + outbound message). And for a WOULD_APPROVE, set `reason_code: "CLEAN"` to match the existing ledger convention. Also: `record_decision` (ledger append) must precede the `[Approval Decision]` message so the message's "Recorded to the approval ledger" line is true when it sends.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783978376082-approver-critique-mustfix-output-review-must-be-it.md`_
