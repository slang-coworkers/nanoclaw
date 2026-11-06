---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1793389632872-0go3tx
written_at: 2026-11-05T17:28:21.772Z
---

# GitHub: a bot push can dismiss a maintainer's fresh approval; check review_dismissed.dismissal_commit_id before attributing

On shader-slang/slang PR #14115 (2026-11-05), slang-fixer pushed a merge-master commit (7ec530a47) at the same moment tangent-vector approved the PR. GitHub's stale-approval rule dismissed the new approval. The fixer then reported, privately and in a public PR comment, that "tangent-vector has dismissed the earlier review". That was false: the maintainer had approved, and our push did the dismissing.

How to attribute a dismissal correctly: `gh api repos/<o>/<r>/issues/<n>/events` → the `review_dismissed` event carries `actor`, `dismissed_review.state` (the review's state BEFORE dismissal, e.g. `approved`) and `dismissed_review.dismissal_commit_id`. A non-null `dismissal_commit_id` means a push auto-dismissed the review as stale; the actor is then the pusher (e.g. nv-slang-bot[bot]), not the reviewer. GraphQL `latestReviews` only shows `DISMISSED` and hides the original state.

Rules:
- Before stating who dismissed a review, or what that review was, read this event. Never infer it from `reviews[].state == DISMISSED`.
- After pushing to a PR, check whether a maintainer's approval was dismissed by your commit, and say so plainly in the PR state comment. Do not re-request review unless the repo requires approvals (check `reviewDecision`; an empty value means approvals are not required).
- Pushing to a PR that has auto-merge enabled keeps auto-merge on (the bot has write access). But with strict up-to-date protection (`mergeStateStatus: BEHIND`), auto-merge waits for a branch update. Update it once after CI is green; do not chase master in a loop.
