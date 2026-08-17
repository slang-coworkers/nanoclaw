---
title: "[approver/calibration] Confirmed-correct ABSTAIN: deferred to a mid-cycle maintainer who then APPROVED the exact decision commit (#12065)"
type: learning
topic: review-approval
source: learnings/1783960819826-approver-calibration-confirmed-correct-abstain-def.md
---

# [approver/calibration] Confirmed-correct ABSTAIN: deferred to a mid-cycle maintainer who then APPROVED the exact decision commit (#12065)

**Outcome (calibration join).** On shader-slang/slang#12065 (Fix #12059, HLSL CoopMat.fill Splat) I returned **ABSTAIN_POLICY / CHALLENGER_CONCERN** @ commit `ace4fa306629` because the sole human reviewer (maintainer jkwak-work) had an unresolved, non-outdated change-request thread and `reviewDecision=REVIEW_REQUIRED`, and the fixer had pushed the review-response revision only ~4 min before the decision window. Two days later jkwak submitted a formal **APPROVED** review ("Looks good to me.") and **merged at exactly my decision commit `ace4fa306629`** — zero follow-up commits between my decision and the merged head. Recorded human_verdict=APPROVED for (repo, 12065, ace4fa306629).

**Why this is a *confirmed-correct* abstain, not a disagreement.** ABSTAIN vs the human's later APPROVE is NOT a false-safe and NOT a human-disagreement. A false-safe is approving where the human wanted changes; a disagreement is BLOCK-where-they-approved (or vice-versa). Here the abstain's whole point was "a human must re-review before this ships" — and the human did precisely that, then approved. The system worked as intended. When you join a `pr_merged`/`pr_review` outcome onto an ABSTAIN_POLICY:CHALLENGER_CONCERN whose stated next-action was "human re-reviews," a subsequent human APPROVE **confirms** the call. Frame it that way; do NOT log it as a mismatch/miss.

**Transferable signal for Step-0 recall.** For a live/live_late PR where the code is clean but a maintainer review is mid-cycle (unresolved+non-outdated thread, REVIEW_REQUIRED, recent fixer response push), the calibrated action is CHALLENGER_CONCERN abstain — and the empirical base rate here is that the maintainer, given a day or two, does the re-review and approves the same commit unchanged. So the abstain is cheap and correct: it neither blocks a good change (the human still merges it) nor risks a false-safe. The turnaround is on the order of ~1–2 days (decision 2026-07-11 21:48Z → approve 2026-07-13 15:22Z → merge 16:38Z), so the join webhook can arrive well after the decision session's original activity; keep a DECISION.md session note naming the pending join so the late webhook is handled cleanly.

**Also confirmed on this PR:** the Devin-only tier verdict for a bot fixer branch (harvest exit 20) was a reliable clean signal — 0 bugs, and the merged code was byte-identical to what Devin reviewed. Devin-only is not a weakness when the scrape is genuine.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783960819826-approver-calibration-confirmed-correct-abstain-def.md`_
