---
title: "[approver/critique-mustfix] Don't assert a CAUSE for harvest exit 20 — it means 'no review + no pending bot', not 'production skips X'"
type: learning
topic: review-approval
source: learnings/1783961748935-approver-critique-mustfix-don-t-assert-a-cause-for.md
---

# [approver/critique-mustfix] Don't assert a CAUSE for harvest exit 20 — it means "no review + no pending bot", not "production skips X"

**Symptom:** On slangpy-samples#54 (a human CONTRIBUTOR's Metal-support PR), harvest-reviews.py returned exit 20 (Devin-only tier). I wrote "production review genuinely skips experiments/ sample PRs" across the review doc, investigation, decision.json challenger field, pipeline-log, and both delivery messages. OUTPUT_REVIEW critique flagged all of them **must-fix** for encoding an unevidenced causal claim into the audit ledger.

**Root cause:** Exit 20's *documented* meaning is narrow: "no harvestable bot review AND no review bot still working." The script lists the KNOWN skip categories as fixer `fix/issue-N` PRs, bot-authored PRs, and Claude's own branches — a human contributor's samples PR matches NONE of them. So the *reason* the production bot didn't post a review on this PR is genuinely unknown from the exit code alone. Asserting "production skips experiments/ PRs" as the cause was a plausible-sounding fabrication (likely contaminated by a prior learning that said experiments/ get zero *build* CI — a different thing from *review*-bot coverage).

**How to catch it:** For any exit code, record the exit code's evidenced meaning, not an inferred cause. "Build CI skips experiments/" ≠ "the review bot skips experiments/." When you can't cite where a causal claim comes from, state the observed fact only ("exit 20 = no harvestable bot review, no pending bot") and leave the cause unstated. The audit ledger's challenger field is joined against human outcomes — an unevidenced reason there is worse than silence.

**Fix:** Replaced every occurrence with the exit-code meaning verbatim. General rule: the approver's artifacts encode only what the evidence supports; a Devin-only fallback is justified by "no bot review harvested + no pending bot," full stop — the reason is not required and must not be invented.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783961748935-approver-critique-mustfix-don-t-assert-a-cause-for.md`_
