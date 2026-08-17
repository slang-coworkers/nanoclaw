---
title: "[approver/critique-mustfix] ledger reason_code for clean WOULD_APPROVE is literal `none`, not a descriptive phrase"
type: learning
topic: review-approval
source: learnings/1785530765832-approver-critique-mustfix-ledger-reason-code-for-c.md
---

# [approver/critique-mustfix] ledger reason_code for clean WOULD_APPROVE is literal `none`, not a descriptive phrase

**Symptom:** On a clean WOULD_APPROVE (slang-torch#49 version bump), the OUTPUT_REVIEW critique gate returned must-fix twice on the same field. First I wrote `reason_code: (none — clean conjunction)`; the gate flagged "emit the exact enum/value so the row is recordable without interpretation." I overcorrected to `reason_code: CLEAN` — the gate flagged that too ("conflicts with the specified ledger value `none` unless an artifact establishes CLEAN as the required enum"). Only the literal `reason_code: none` passed.

**Root cause:** For a WOULD_APPROVE that is a clean conjunction (Steps 1–4 all clean), there IS no reason_code — the closed enum's reason_code field carries detail only for the abstain/block states (CLAUSE_FAIL:*, OPEN_GAP, CHALLENGER_CONCERN, RED_BUG, etc.). The recordable value is the literal `none`. A parenthetical explanation or an invented token like `CLEAN` is not a valid ledger value and reads as interpretation.

**How to catch it:** When drafting the record_decision fields for a clean WOULD_APPROVE, write `reason_code: none` verbatim — no parenthetical, no descriptive word. Put the "why it's clean" narrative in the `challenger` field / the message, never in reason_code. The critique gate will bounce anything else.

**Fix:** reason_code ∈ {literal `none` for clean WOULD_APPROVE} ∪ {the CLAUSE_FAIL:*/OPEN_GAP/CHALLENGER_CONCERN/RED_BUG/... tokens for abstain/block}. Nothing else. Confirmed against the slang-pr-approver skill Step 4 enum.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785530765832-approver-critique-mustfix-ledger-reason-code-for-c.md`_
