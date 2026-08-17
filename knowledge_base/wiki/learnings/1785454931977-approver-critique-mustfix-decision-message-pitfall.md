---
title: "[approver/critique-mustfix] Decision-message pitfalls: critique-state overclaim + revision-delta vs full-PR diff-stat conflation"
type: learning
topic: review-approval
source: learnings/1785454931977-approver-critique-mustfix-decision-message-pitfall.md
---

# [approver/critique-mustfix] Decision-message pitfalls: critique-state overclaim + revision-delta vs full-PR diff-stat conflation

## Symptom
On a `synchronize` re-decision (PR #1083 R1, WOULD_APPROVE), the OUTPUT_REVIEW
critique gate bounced the `[Approval Decision]` message **four times** before
approving — every bounce a must-fix on the *message wording*, not the decision.
Two distinct recurring classes:

### Class A — self-referential critique/recording overclaim
The draft message asserted process state that had not happened yet at draft
time:
- "Both critique stages (DECISION_REVIEW, OUTPUT_REVIEW) recorded = approve" —
  written while *inside* the OUTPUT_REVIEW stage. OUTPUT_REVIEW cannot certify
  itself as already-passed.
- "read-only shadow decision **recorded** to the approval ledger" — past tense,
  but `record_decision` runs *after* the gate opens, later in the same turn.

### Class B — diff-stat conflation (revision delta vs full-PR size)
Labeled the *revision-only delta* (the new commit vs the prior head) with the
*full-PR* line count. Full PR at head = 2 files **+9/-0**; the new synchronize
commit was **+4/-1** (comment-only: `test_buffer.slang +2/-1`,
`test_buffer.py +2/-0`). `clauses.json` "9 lines / 2 files" is the *eligibility
size* (full PR), which is NOT the revision delta — do not reuse it as the
"what changed this push" number.

### Class C (advisory, recurring) — prior-approval anchoring
"byte-identical to **the approved revision**" / "prior head … **already
WOULD_APPROVE**" leans the challenger on the prior verdict. Revision-chain rule:
the prior head is *context, not evidence*. State it as "prior head <sha>
(compare shows only X changed)".

## Root cause
Drafting the upstream message in the same breath as the decision, using
completed-tense/aggregate-convenience phrasing, before the gated steps that
those phrases describe have run.

## How to catch it (pre-draft checklist for the [Approval Decision] message)
1. **Tense:** anything the gate/ledger does happens AFTER the message is
   approved — phrase recording as "is being recorded this turn", never
   "recorded". Never claim a critique stage's own verdict inside that stage.
2. **Two different diff numbers, stated separately:** full-PR size
   (`main...head`, = clauses eligibility size) AND, for a synchronize,
   revision delta (`prior_head...head`). Get each from the right source
   (`gh api compare prior...head` for the delta), never reuse one for the other.
3. **No prior-verdict anchoring:** the prior head is context; reference it by
   SHA + the compare fact, not by its verdict.

## Fix
Bake these three into the message template so the first OUTPUT_REVIEW pass is
clean. Recurring must-fixes on message wording are a procedure bug, not
per-PR noise. See [[review-approver-decision-procedure]].

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785454931977-approver-critique-mustfix-decision-message-pitfall.md`_
