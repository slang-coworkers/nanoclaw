---
title: "[approver/challenger-miss] A still-present false claim the current revision's review didn't re-list is still a live gap — challenger re-checks carried-over diff content, doesn't defer to 'not re-flagged'"
type: learning
topic: review-approval
source: learnings/1783937211976-approver-challenger-miss-a-still-present-false-cla.md
---

# [approver/challenger-miss] A still-present false claim the current revision's review didn't re-list is still a live gap — challenger re-checks carried-over diff content, doesn't defer to "not re-flagged"

**Symptom:** PR shader-slang/slang#11977 revision R2 (@7e2b01d636ac). At R1 (@d2b62699) the head-matched primary review flagged a false API-ordering claim in `tools/shader-coverage/README.md:142` (getEntryPointCode before getEntryPointMetadata, else E_INVALIDARG — code-confirmed false, codex-concurred). At R2 the author pushed more commits; the fresh head-matched primary review's *findings table* NO LONGER listed that README gap (it surfaced different nits instead), though its Changes Overview still described adding the caveat. The naive move — "parse the verdict, don't reinterpret; the current review doc didn't flag it, so it's clear" — would have upgraded toward WOULD_APPROVE.

**Root cause / the call:** Code facts about the repo do not change between revisions, and the false claim was STILL in the R2 diff (grep-verified README.md:142-146 verbatim). A reviewer not re-listing a still-present defect is not evidence the defect was fixed — LLM reviewers surface a rotating subset of findings per run. The skill's "parse, don't reinterpret" governs the VERDICT tier/BLOCK mapping (Step 2); Step 3 challenger is explicitly the adversarial-maintainer reasoning step that investigates the actual diff. Treating a carried-over, independently-confirmed-false public-docs claim as a live OPEN_GAP is squarely the challenger's job, not a reverdict.

**How to catch it:** On any revision (synchronize) turn, do NOT assume a gap confirmed real on a prior revision is resolved just because the new review doc omits it. Check whether the offending diff content is STILL PRESENT at the new head (grep the changed file at the pinned SHA). If still present and the code facts that made it a defect are unchanged, it remains a live gap regardless of re-flagging. Only an actual edit removing/fixing it clears it. Confirmed sound by the codex DECISION_REVIEW gate, which explicitly endorsed treating the still-present-but-unflagged claim as a live OPEN_GAP via the challenger role (not an overstep of "parse, don't reinterpret").

**Fix / rule:** Prior-revision findings that were confirmed real are a checklist to re-verify against the new head's diff, not evidence to discard. "Not re-flagged this run" ≠ "fixed." Re-decide each revision on its own doc AND on the current state of the code the doc reviews. Relates to [[approver-challenger-devin-cross-platform-filename-false-positive]] (same PR, Devin's ps1:129 false positive re-verified across both revisions).

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783937211976-approver-challenger-miss-a-still-present-false-cla.md`_
