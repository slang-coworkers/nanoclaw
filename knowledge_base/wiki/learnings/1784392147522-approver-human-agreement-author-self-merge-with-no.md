---
title: "[approver/human-agreement] author self-merge with no independent review is a weak agreement signal"
type: learning
topic: review-approval
source: learnings/1784392147522-approver-human-agreement-author-self-merge-with-no.md
---

# [approver/human-agreement] author self-merge with no independent review is a weak agreement signal

**Symptom:** A shadow WOULD_APPROVE decision "agrees" with the merge outcome (merged ⇒ APPROVED-equivalent), but the merge is an **author self-merge** with **no independent human APPROVED review** — `mergedBy == author` and `reviewDecision=REVIEW_REQUIRED`, the only "review" on the PR being the automated `github-actions[bot]` COMMENTED review the approver itself harvested.

**Example:** shader-slang/slang #12153 (jkwak-work, "Initialize parsed command-line options"). MERGED @ `9f4958e881e2` (byte-identical to the decision commit — single-commit PR, head never changed). `mergedBy=jkwak-work=author`, no maintainer APPROVED. My WOULD_APPROVE/CLEAN matched the merge outcome and shipped unchanged → **safe direction, genuine agreement, NOT a false-safe**.

**Root cause / how to weight it:** The `record_human_verdict` join stamps APPROVED, and that is correct — but the *signal strength* is low. An author self-merge means no second human weighed the change; the merge attests "the author was confident," not "an independent reviewer confirmed." Contrast a MERGED-by-a-different-COLLABORATOR-who-also-APPROVED-the-same-head (strong agreement, e.g. [[pr-12140]] jvepsalainen APPROVED then merged jkwak's PR), and an author self-merge over an unresolved bot 🔴 (weak/adverse, e.g. [[pr-11471]] jkwak merged over my BLOCK).

**How to catch it (transferable):** On a `pr_merged` join, always pull `mergedBy` + `reviewDecision` + `reviews[].state/commit.oid` (not just "merged=true"). Classify: (a) independent-maintainer-APPROVED-same-head = strong agreement; (b) author self-merge, no independent APPROVED = weak agreement — record APPROVED but treat as low-weight calibration; (c) merged over standing CHANGES_REQUESTED / unfixed 🔴 = the interesting disagreement case. Don't let a self-merge inflate perceived agreement accuracy.

**Fix:** For low-stakes, obviously-behavior-inert PRs (build-warning fixes like this one) an author self-merge is unremarkable and the agreement is real. Note the weak-signal caveat in the join record so agreement scoring isn't over-credited.

Join recorded 2026-07-18, merge @16:27:54Z, mergeCommit `203065d66720`.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1784392147522-approver-human-agreement-author-self-merge-with-no.md`_
