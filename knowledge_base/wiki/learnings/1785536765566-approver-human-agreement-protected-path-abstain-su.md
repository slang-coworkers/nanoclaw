---
title: "[approver/human-agreement] protected-path ABSTAIN survives workflow-only follow-up commits — class-invariance check on join"
type: learning
topic: review-approval
source: learnings/1785536765566-approver-human-agreement-protected-path-abstain-su.md
---

# [approver/human-agreement] protected-path ABSTAIN survives workflow-only follow-up commits — class-invariance check on join

## Symptom
slang-rhi#804 (board-sync onboarding, jhelferty-nv MEMBER) got ABSTAIN_POLICY:CLAUSE_FAIL:no_protected_paths across three revisions (R1 ae2361bbbbec / R2 f88d104571ac / R3 8271617af766 — all 7 files `.github/**`). It then MERGED with reviewDecision=APPROVED and an INDEPENDENT maintainer approval (jkwak-work, non-author, APPROVED before the author merged — not a bare self-merge). Merged ⇒ APPROVED-equiv.

## Root cause / why this is agreement, not false-safe
A protected-path ABSTAIN asserts NOTHING about the code — it hands the change to a human because CI/workflow automation (`.github/**`) is out of the auto-approve envelope by policy. An APPROVED-merge is therefore **directional agreement**: the human loop the abstain routes to (here, jkwak-work maintainer inspection) is exactly what cleared it. This is the do-not-round-up class working as intended, mirror of [[pr-12142]] (fork-codegen unrun-test ABSTAIN vindicated by maintainer APPROVE).

## The transferable signal: class-invariance under head-move
The merge head moved **2 commits past my R3 decision** (`878ab52710c4`: +"Simplify zizmor.yml comment" +"Add nightly PR board sweep caller" — a NEW file `.github/workflows/pr-sweep-nightly.yml`). Join-SHA-first ([[pr-12095]], [[pr-12141]]) caught the move. But the decisive extra step: **check whether the moved head stayed in the SAME decision class.** Here both follow-up commits were still `.github/**`, so re-deciding at the merged head would yield the identical ABSTAIN — the head-move is calibration-neutral. Contrast [[pr-12095]], where a post-decision commit DELETED the exact code the challenger flagged, flipping the class → that head-move made WOULD_APPROVE@decided-SHA a would-be false-safe.

## How to apply
On a `pr_merged`/`pr_closed` join where the head moved past your decision commit: don't stop at "head moved". Pull the intervening commits' changed paths and ask "would my clause/verdict have changed at the merged head?" If the follow-ups stay within the same clause outcome (e.g. still all protected-path, still same size tier), the decision class is invariant and the human verdict maps cleanly to your recorded row. If they cross a clause boundary or touch the code a challenger cleared/flagged, that's the real calibration signal — score against what the human actually shipped, not your frozen SHA.

## Class note
Board-sync onboarding is a recurring multi-repo rollout (companions slangpy#1084, slangpy-samples#57) that arrives as workflow-only PRs and iterates via workflow-only synchronizes (zizmor/pin tweaks, added caller workflows). Expect: repeated ABSTAIN_POLICY:no_protected_paths across revisions, all vindicated by maintainer merge, all class-invariant. Precedent siblings: slang#12084, slang#12154 (protected-path ABSTAIN).

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785536765566-approver-human-agreement-protected-path-abstain-su.md`_
