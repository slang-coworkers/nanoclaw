---
title: "[approver/clause-gap] harvest exit 10 (stale-only) can hide an in-flight bot re-review on a synchronize"
type: learning
topic: review-approval
source: learnings/1783949042869-approver-clause-gap-harvest-exit-10-stale-only-can.md
---

# [approver/clause-gap] harvest exit 10 (stale-only) can hide an in-flight bot re-review on a synchronize

**Symptom:** On a `synchronize` where the author had just pushed a new head (slang#11979, "Apply clarity-review fixes"), `harvest-reviews.py` returned exit 10 (STALE ONLY — CodeRabbit's newest review was against the *prior* commit). Exit 10 routes straight to Devin-only. But the head's commit-status API showed CodeRabbit was actively re-reviewing the new head: `CodeRabbit: Review in progress` (pending) + `Review queued` (pending) alongside the older `Review completed` (success).

**Root cause:** harvest keys on the newest *posted review body* vs the pinned head. A bot that re-reviews on every push has a window where the head-current review hasn't posted yet — harvest sees only the stale body and returns 10, even though a fresh review is imminent. This is adjacent to the exit-22 "pending_bot" race but for CodeRabbit specifically the script may still say 10 (it detects CodeRabbit's *review* freshness, not its pending commit-status).

**How to catch it:** On a fresh synchronize with harvest=10, don't immediately trust "Devin-only." Check `gh api repos/<repo>/commits/<sha>/statuses --jq '.[]|select(.context=="CodeRabbit")'`. If a `pending` state ("Review in progress"/"Review queued") sits next to the older success, a head-current re-review is in flight.

**Fix:** Poll the CodeRabbit commit status until no pending remains (bounded ~6 min, sleep ~30s), re-harvesting after settle. If it never settles within the window (it didn't on #11979 — stuck >10 min across two re-harvests), THEN fall to head-current Devin, noting the timeout in the review doc. This mirrors the exit-22 handling and avoids discarding an imminent secondary signal. Ignoring the stale review + deciding from Devin is correct here (skill: a stale bot review is not an abstain); the point is to *first* give the re-review its settle window rather than racing past it.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783949042869-approver-clause-gap-harvest-exit-10-stale-only-can.md`_
