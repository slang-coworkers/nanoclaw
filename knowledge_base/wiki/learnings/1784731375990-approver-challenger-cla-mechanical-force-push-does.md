---
title: "[approver/challenger] CLA/mechanical force-push does not clear a standing CHANGES_REQUESTED — same withhold posture"
type: learning
topic: review-approval
source: learnings/1784731375990-approver-challenger-cla-mechanical-force-push-does.md
---

# [approver/challenger] CLA/mechanical force-push does not clear a standing CHANGES_REQUESTED — same withhold posture

# [approver/challenger] A mechanical squash/rebase/re-author (CLA fix) does NOT clear a standing CHANGES_REQUESTED — the withhold posture carries into the new revision

**PR:** shader-slang/slang#11136. R1 @bcb552353da9 → R2 @452d965a056c, both ABSTAIN_POLICY (CHALLENGER_CONCERN), mode=live_late. Fixer PR (nv-slang-bot), Devin-only tier.

## Symptom / setup
A superseding force-push landed and was framed (by the orchestrator, relaying the fixer) as potentially posture-changing: maintainer jhelferty-nv had asked for a squash + rebase-on-master + re-author as nv-slang-bot because the `slang-fixer` pseudonym on the original commit was snagging CLAssistant. The tempting read: "the maintainer asked for this change and the fixer did it, so maybe the CHANGES_REQUESTED is satisfied / about to clear."

## Root cause / the rule
A GitHub `CHANGES_REQUESTED` review does NOT auto-dismiss on a force-push, rebase, or re-author. It stays standing until the requesting maintainer explicitly re-reviews, dismisses, or approves. A maintainer asking for a *mechanical* change (CLA unblock, history rewrite) is NOT the same as them clearing their *substantive* review — the review can remain `CHANGES_REQUESTED` indefinitely after the mechanical ask is satisfied, because clearing it requires a separate deliberate action. So a superseding revision whose only delta is mechanical inherits the exact same withhold posture as the prior revision.

Verified at R2 settle: `reviewDecision` still `CHANGES_REQUESTED`, jhelferty-nv's review `submittedAt` unchanged (`2026-07-17T21:01:26Z`), thread `resolved=false`. The CLA unblock did not flip anything.

## How to catch it (procedure)
- On a "new push supersedes" revision, ALWAYS re-harvest the LIVE `reviewDecision` + `reviews[]` + review-thread resolution at settle (`gh pr view --json reviewDecision,reviews` + the reviewThreads GraphQL). Do NOT infer the review state from the *reason* for the push.
- Treat framing like "maintainer asked for X and fixer complied" as context, not as a review-clear. The decision axis is the live `reviewDecision`, not the PR narrative.
- Confirm the code delta is what's claimed: for a mechanical rebase, the PR-introduced hunk should be identical to the prior revision (verify by patch-id / blob hash — the *file* hash will differ due to the rebased base, but the PR-introduced content should match). If the "mechanical" push actually changed code, it's not mechanical — run the full challenger on the new content.

## Fix / outcome
R2 re-ran the full fresh cycle (clauses 6/6, fresh Devin clean, fresh challenger) and landed ABSTAIN_POLICY:CHALLENGER_CONCERN again — same basis as R1, correctly re-derived on the new head, NOT carried forward. One ledger row per revision; R1 row now stale. Related: [[pr-11136-decided]] and the R1 learning "standing human CHANGES_REQUESTED vetoes WOULD_APPROVE regardless of clean doc".

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1784731375990-approver-challenger-cla-mechanical-force-push-does.md`_
