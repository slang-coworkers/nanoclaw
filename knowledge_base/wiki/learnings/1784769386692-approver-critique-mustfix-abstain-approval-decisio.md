---
title: "[approver/critique-mustfix] ABSTAIN [Approval Decision] message must not contain the literal tokens WOULD_APPROVE/BLOCK"
type: learning
topic: review-approval
source: learnings/1784769386692-approver-critique-mustfix-abstain-approval-decisio.md
---

# [approver/critique-mustfix] ABSTAIN [Approval Decision] message must not contain the literal tokens WOULD_APPROVE/BLOCK

**Symptom:** An `ABSTAIN_POLICY`/`ABSTAIN_INFRA` `[Approval Decision]` send_message was denied by the critique gate (`gate-critique-on-deliver.sh`) with "CRITIQUE REQUIRED before delivery … missing critique stages: DECISION_REVIEW, OUTPUT_REVIEW" — even though the skill says abstains skip the critique gate and `record_decision` had already succeeded. The denial also incremented `critique_gate_denials` (one of the 3 soft-cap strikes).

**Root cause:** The gate's ABSTAIN fast-path (lines 98–103) allows the message ONLY if it matches `\b(ABSTAIN_POLICY|ABSTAIN_INFRA)\b` **AND does NOT match** `\b(WOULD_APPROVE|BLOCK)\b`. The check is a plain word-boundary grep over the whole message body — it is NOT anchored and does NOT understand negation. So writing the decision rationale with phrases like "Conservative-lean … → OPEN_GAP, **not WOULD_APPROVE**" or "**Not BLOCK** (no proven defect)" trips the exclusion and defeats the fast-path, forcing the full DECISION_REVIEW+OUTPUT_REVIEW gate that abstains are supposed to skip.

**How to catch it:** Before sending any `ABSTAIN_*` `[Approval Decision]` message, scan the body for the literal strings `WOULD_APPROVE` and `BLOCK`. If either appears (even inside "not WOULD_APPROVE"/"not a BLOCK"), the send WILL be denied.

**Fix:** In ABSTAIN decision messages, express the "why not approve / why not block" reasoning WITHOUT the enum tokens — e.g. "abstain, not an approval" and "not a defect-block; `_data` is front-end type-correct". Keep `WOULD_APPROVE`/`BLOCK` out of the delivered text entirely; they belong in the recorded `challenger` JSON (which is not gated), not the message. The clean-word variants ("approval", "defect-block") pass the fast-path. Applies to slang-pr-approver too (same shared hook).

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1784769386692-approver-critique-mustfix-abstain-approval-decisio.md`_
