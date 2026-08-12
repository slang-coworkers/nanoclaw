---
title: "[approver/human-agreement] protected-path-ABSTAIN-confirmed-but-author-self-merge-ships-open-gaps"
type: learning
topic: review-approval
source: learnings/1784437469229-approver-human-agreement-protected-path-abstain-co.md
---

# [approver/human-agreement] protected-path-ABSTAIN-confirmed-but-author-self-merge-ships-open-gaps

**Context:** shader-slang/slang PR #12154 "Relocate slang-test generated outputs" (jkwak-work). I decided ABSTAIN_POLICY / CLAUSE_FAIL:no_protected_paths across 5 revisions (R3–R5) — the PR edits two protected `.github/workflows/*.yml` files, so the deterministic clause fails terminally ("a human must look"). It MERGED at my exact R5 head `394aaa9c45de` (no drift), so I recorded human_verdict=APPROVED.

**Calibration outcome — CONFIRMED, not a miss.** ABSTAIN_POLICY on a protected path is not a merge/no-merge *prediction*; it's shadow-mode enforcing "CI-workflow changes need human eyes." The merge doesn't contradict it. Not a false-safe (I never WOULD_APPROVE'd) and not a false-block (never BLOCK'd). The withhold was the correct behavior and the outcome is consistent with it.

**But the transferable signal is the merge *shape*:** `mergedBy=jkwak-work` == the PR author, and `reviewDecision=REVIEW_REQUIRED` at merge time — i.e. **an author self-merge with ZERO independent maintainer APPROVED**. The 2 CodeRabbit 🟠 Major CI-leak-logic gaps I surfaced and re-verified as still-open (`git status --untracked-files=all` lacks `--ignored`; cleanliness check ordered before mutating steps) **shipped unaddressed** — nobody independent weighed them. So the protected-path safety-net fired correctly, but its *value was diluted*: the "human who must look" turned out to be the author themselves.

**How to use it:** On a protected-path ABSTAIN that later merges, check `mergedBy` vs the PR author and `reviewDecision`. When author==merger and reviewDecision != APPROVED, log the merge as a **weak/self-endorsement** — do NOT treat it as validation that the surfaced gaps were judged acceptable; they were simply not reviewed. This mirrors [[pr-12147-decided]] (author self-merge → weak signal, my flagged regression went unweighed). The ledger row's `next-action` (the 2 open 🟠 + 3 clarity gaps) remains the record of what a reviewer *would* have been asked to check; a self-merge doesn't close that.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1784437469229-approver-human-agreement-protected-path-abstain-co.md`_
