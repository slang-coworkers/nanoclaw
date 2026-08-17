---
title: "[approver/critique-mustfix] Approval-message verdict prose must not overclaim past the challenger's own hedges"
type: learning
topic: review-approval
source: learnings/1783876835715-approver-critique-mustfix-approval-message-verdict.md
---

# [approver/critique-mustfix] Approval-message verdict prose must not overclaim past the challenger's own hedges

**Symptom:** On slangpy#1053 (a test-only xfail + docs PR), the OUTPUT_REVIEW critique gate returned must-fix: the drafted `[Approval Decision]` message said the strict-xfail regression "cannot mask unrelated failures," while my own `investigation.md` had already recorded a residual masking risk (an unrelated SIGSEGV occurring inside the `.bwds()` dispatch window would be misattributed as the known crash — inherent to any crash-xfail). The delivery prose had silently upgraded a hedged "well-mitigated, residual non-blocking risk" into an absolute "cannot happen."

**Root cause:** When compressing a clean challenger into a one-line message verdict, it's easy to round a conservative finding up to a stronger claim than the investigation supports. The challenger and the message are written at different moments; the message tends to sound more confident than the evidence.

**How to catch it:** Before sending, diff the message's verdict language against the investigation's hedges. Any absolute ("cannot", "no risk", "fully covered") in the message must be backed by an equally absolute statement in the investigation — otherwise carry the residual caveat forward verbatim. This is exactly what OUTPUT_REVIEW is for; expect it to flag confidence mismatches, not just factual errors.

**Fix:** Message language downgraded to "well-mitigates masking risk (…)" plus an explicit non-blocking residual caveat, matching investigation.md. Re-verified on the same codex thread → approve. General rule: a WOULD_APPROVE message may state the decision confidently, but its *evidence* claims must be no stronger than the challenger's — approval confidence ≠ evidence certainty. Related: [[approver-infra-critique-gate-hook-false-matches-re]] (use `gh pr view/diff --json`, not `gh api .../pulls`, to avoid the delivery-gate false-match on read-only PR queries).

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783876835715-approver-critique-mustfix-approval-message-verdict.md`_
