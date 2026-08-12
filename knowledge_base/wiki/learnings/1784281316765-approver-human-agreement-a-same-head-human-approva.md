---
title: "[approver/human-agreement] A same-head human APPROVAL is a JOIN signal, not a reason to flip your OPEN_GAP to WOULD_APPROVE"
type: learning
topic: review-approval
source: learnings/1784281316765-approver-human-agreement-a-same-head-human-approva.md
---

# [approver/human-agreement] A same-head human APPROVAL is a JOIN signal, not a reason to flip your OPEN_GAP to WOULD_APPROVE

**Symptom:** On PR #12144 R2, a maintainer (skiminki-nv) had already submitted an APPROVED review at the *exact* commit I was deciding (mode became live_late). The temptation is to conclude "a maintainer approved this head, so the gap must be fine — flip to WOULD_APPROVE." That is the "round up to approve" anti-pattern the invariants forbid.

**Root cause:** The approver's decision is scored *against* human outcomes; the human verdict is the calibration/join signal, not an input to the decision. If you let a visible human approval upgrade your independent read, you stop being an independent check — you just echo the human, and the agreement statistic becomes meaningless (you can't measure agreement between two copies of the same signal). The skill is explicit: investigation "can only add caution, never upgrade"; "never round up to approve."

**How to catch it:** When you find a human review already present at your pinned head, keep two things strictly separate: (1) your independent decision, derived only from clauses + review doc + your own challenger read; (2) the human verdict, recorded via `record_human_verdict` purely for calibration. If your independent read is ABSTAIN(OPEN_GAP) and the human approved the same head, that is the healthy **withhold-on-SAFE AGREEMENT** outcome — you held on a low-severity SAFE gap, the human shipped it, nothing broke, no false-block. Record BOTH: your ABSTAIN_POLICY(OPEN_GAP) decision row AND the APPROVED human verdict. Do not collapse them.

**Fix:** Decide first from your own evidence with the human verdict deliberately walled off; only after recording the decision, record the human verdict as the join. The correct posture for "low-severity gap persists + maintainer approved same head" is ABSTAIN_POLICY(OPEN_GAP) + human_verdict=APPROVED = withhold-on-SAFE agreement (same class as #12064/#12090/#12138), NOT WOULD_APPROVE.

**Bonus (same PR, procedure):** When a PR head churns rapidly (here 5 pushes in ~90 min, including add-then-revert of wrapper scripts), a debounce *monitor* that resets its quiet timer on every head move — and only fires SETTLED after N seconds of no movement — lets you build the review input ONCE at the final head instead of burning a harvest+Devin+decision cycle per push. Also: when a bot (Devin) reviews the live PR across churn, its findings can name files that were reverted and are 404 at your pinned head — verify each flagged file still exists at the pinned commit before treating the finding as live.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1784281316765-approver-human-agreement-a-same-head-human-approva.md`_
