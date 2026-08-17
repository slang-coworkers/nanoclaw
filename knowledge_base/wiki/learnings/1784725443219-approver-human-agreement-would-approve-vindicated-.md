---
title: "[approver/human-agreement] WOULD_APPROVE-vindicated-merged-head-byte-identical-via-master-merge-syncs"
type: learning
topic: review-approval
source: learnings/1784725443219-approver-human-agreement-would-approve-vindicated-.md
---

# [approver/human-agreement] WOULD_APPROVE-vindicated-merged-head-byte-identical-via-master-merge-syncs

**Symptom:** Recorded WOULD_APPROVE (CLEAN) for slang#11665 @`8c3a3ee1` (Jul 17). Merge webhook arrived Jul 22 with `merged_by=skiminki-nv`. On join, live GitHub showed the merged head was `d01027a0639a` — NOT my recorded SHA. Two commits had landed on the branch after my decision (`f51fe08` Jul 20, `d01027a` Jul 22), and I received NO synchronize webhook for either.

**Root cause / resolution:** Both intervening commits were "Merge branch 'master' into fix/issue-11664" — pure upstream syncs, not edits to the PR's contribution. Verified rigorously by computing each head's OWN three-dot PR diff against its master merge-base (`git diff origin/master...<head> -- <PR's files>`) and sha256-ing the operator-name lines: **byte-identical** (`c43dcf9e…76c53b`) at both `8c3a3ee1` and `d01027a`. So the decision was NOT stale in substance — the merged code equals what I approved. Maintainer skiminki-nv (NOT the author — author is nv-slang-bot) reviewed APPROVED at `d01027a` and merged (reviewDecision=APPROVED, non-self-merge) → **genuine agreement, VINDICATED**. Recorded human_verdict=APPROVED against the existing `8c3a3ee1` row.

**How to catch it (transferable procedure):**
1. On ANY join, the first move is verify SHA vs live GitHub (`gh pr view <n> --json state,mergedAt,mergedBy,mergeCommit,headRefOid,reviewDecision` — note: field is `state`/`mergedAt`, NOT `merged`; `reviews` isn't a `pr view` json field, use `gh api repos/<r>/pulls/<n>/reviews`).
2. If the merged head ≠ your recorded head, DO NOT assume the row is stale and DO NOT assume it's still valid. **Prove substance-equivalence**: `git diff origin/master...<mergedHead> -- <PR-touched files>` vs the same at your decided head, checksummed. Master-merge commits routinely move the head with zero change to the PR's own diff — those are substance-equivalent and your decision still holds.
3. Only if the PR's OWN diff changed do you treat the row as superseded and (in live mode) decide the new revision fresh.
4. `mergedBy` == author ⇒ self-merge (weak endorsement); `mergedBy` ≠ author AND reviewDecision=APPROVED with an independent APPROVED review at/after the merged head ⇒ genuine agreement. Here nv-slang-bot(author) ≠ skiminki-nv(merger+approver) = clean.

**Gap noted:** the synchronize webhooks for the two master-merge revs never reached me (session had exited/restarted Jul 17→22). The settled-head + join-time SHA-verification is what caught it — reinforces that join-time SHA verification is mandatory, not optional. [[pr-11665-awaiting-join]]

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784725443219-approver-human-agreement-would-approve-vindicated-.md`_
