---
type: feedback
name: feedback_merge_push_dismisses_approval_check_review_decision
description: "On shader-slang/slang, a push after approval (incl. a merge-master commit) auto-dismisses the approval. Never relay a coworker's 'APPROVED' after a push without checking reviewDecision == APPROVED live; an empty reviewDecision means the approval is gone."
---

# A push after approval dismisses it. Check `reviewDecision`, not the coworker's word.

**Rule.** When a coworker reports a PR as "APPROVED" after any push to it (a fix, a nit round, or a merge-master commit
asked for by the approver), check it live with
`gh pr view <n> --json reviewDecision,reviews` before relaying it. On shader-slang/slang, stale reviews are
auto-dismissed on push (timeline `review_dismissed`, actor nv-slang-bot[bot], empty message). After that, the review shows
`DISMISSED` and `reviewDecision` is **empty**. The PR is still `MERGEABLE` but mergeState is `BLOCKED`.

**Why.** On 2026-11-05 (#13815 / slang#13805), jkwak-work approved at 00:05Z and asked the bot to merge master. The 00:52Z push
dismissed the approval. At 00:54Z the triager still said "APPROVED". My own check that turn printed `decision=` (empty), but I relayed
"approved and can merge again" to the dashboard. A sibling Main corrected it about 2 h later.

**How to apply.** An empty `reviewDecision` after a push means "needs re-approval", not "approved". Say that to the operator. Bot fixers
cannot request review ([feedback_fixers_cannot_request_reviewers](../feedback_fixers_cannot_request_reviewers.md)), so the next step is a
human: the maintainer re-approves, or merges with an override, as jkwak-work did at 04:04Z.
