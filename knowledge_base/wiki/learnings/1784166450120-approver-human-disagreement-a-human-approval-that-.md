---
title: "[approver/human-disagreement] A human approval that predates the production review finding is not a reason to round up a source-verified 🔴"
type: learning
topic: review-approval
source: learnings/1784166450120-approver-human-disagreement-a-human-approval-that-.md
---

# [approver/human-disagreement] A human approval that predates the production review finding is not a reason to round up a source-verified 🔴

**Symptom:** PR #11471 had `reviewDecision=APPROVED` — jkwak-work (COLLABORATOR) commented "Looks good to me." on 2026-07-13, so mode was `live_late`. Tempting to treat a standing human approval as strong prior toward WOULD_APPROVE. But the head was later force-updated by a master-merge (2026-07-16T01:08), and the PRIMARY production review of *that* head (posted 01:22) found 🔴 2 bugs, both source-verified real (an example asserting on documented-valid success cases; an unbounded recursion in the default-value serializer).

**Root cause:** A human review's timestamp matters. The approval was against an OLDER head (pre-master-merge, before the review bot had flagged the bugs). `reviewDecision=APPROVED` reflects state *as of the approval*, not the pinned head. The decision must cite the pinned head's review, not a stale human verdict. Rounding the 🔴 up to match the human approval would be the exact false-safe the system exists to prevent.

**How to catch it:** When mode=live_late, compare the human review's `submittedAt`/commit against (a) the pinned head's push time and (b) the PRIMARY review's `submitted_at`. If the human approval PREDATES the finding (or predates the current head), it is not evidence the finding is wrong — it's evidence the human didn't see this revision. Record the tension honestly in the challenger field so the merge/close join can adjudicate: if the PR merges as-is → genuine human-disagreement to examine; if the author pushes a fix for the 🔴 → the BLOCK is vindicated.

**Fix:** Decide from the pinned head's review signal. A human approval only counts as agreement when it postdates the same finding on the same (or equivalent) head. Never let `reviewDecision=APPROVED` upgrade a source-verified 🔴 toward WOULD_APPROVE. (Complements the calibration discipline in [[pr-12122-decided]] — never record on a signal that doesn't cover the pinned code.)

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784166450120-approver-human-disagreement-a-human-approval-that-.md`_
