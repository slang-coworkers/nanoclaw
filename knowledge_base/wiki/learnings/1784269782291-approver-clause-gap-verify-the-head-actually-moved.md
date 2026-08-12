---
title: "[approver/clause-gap] Verify the head actually moved before honoring a 'synchronize' re-decision tasking — a comment can masquerade as a push"
type: learning
topic: review-approval
source: learnings/1784269782291-approver-clause-gap-verify-the-head-actually-moved.md
---

# [approver/clause-gap] Verify the head actually moved before honoring a "synchronize" re-decision tasking — a comment can masquerade as a push

**Symptom:** Orchestrator tasked a re-decision on slang#12138 stating "new synchronize events ×2, head moved past 9f5ce276, author pushed twice." Live GitHub contradicted it: head was STILL 9f5ce276 (the commit I'd already decided at R2), same 3 commits, no force-push, no check-run started after the original push, and zero new PushEvents. The PR's `updated_at` had bumped — but from a **human issue comment by LDeakin**, not a push.

**Root cause:** A PR's `updated_at` timestamp advances on ANY activity — issue comments, label changes, reviews — not just head changes. A webhook or upstream summarizer that keys "synchronize" off an `updated_at` delta (rather than an actual head-SHA change or a `head_ref_force_pushed`/`PushEvent`) will misreport a comment as a push. Acting on that blindly would record a DUPLICATE ledger row for an identical commit (violating one-decision-per-revision) and waste a full harvest+Devin+challenger+critique cycle.

**How to catch it:** Before re-running the procedure on a claimed synchronize, confirm the head ACTUALLY moved, via ≥2 independent signals:
1. `gh api repos/<o>/<r>/pulls/<n> -q .head.sha` — compare to your last decided commit. Same SHA ⇒ no new revision.
2. `gh api repos/<o>/<r>/issues/<n>/timeline` — look for a `head_ref_force_pushed` or a `committed` event newer than your decided head.
3. `gh api repos/<o>/<r>/commits/<sha>/check-runs -q '.check_runs[].started_at'` — a real push spawns fresh check-runs; all-old timestamps ⇒ head didn't move.
4. The fork's events feed (`gh api repos/<fork-owner>/<r>/events`) PushEvents — but scope the claim to "no push AFTER my decided head's push time" (the existing commits DO show as PushEvents; don't overclaim "zero PushEvents").
If the head is unchanged, do NOT re-run and do NOT record. Report the discrepancy upstream (prior decision stands), read whatever DID change (the comment), and re-evaluate it on its merits — a substantive human comment can still re-open a chain even when no code changed.

**Fix:** Treat "verify head moved" as the first gate of any synchronize-triggered re-decision, mirroring the "verify join SHA vs live GitHub" rule for merge/close joins. Here the comment was a design clarification (spec-const workgroup validation belongs at pipeline-creation time, not shader-compilation time — corroborating the fix) that changed neither OPEN_GAP hold, so the prior ABSTAIN stood; recommend the operator check the webhook source that conflated comment-vs-push.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1784269782291-approver-clause-gap-verify-the-head-actually-moved.md`_
