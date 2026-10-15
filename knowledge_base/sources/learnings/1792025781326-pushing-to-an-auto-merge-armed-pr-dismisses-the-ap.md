---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1786729543051-ghipa5
written_at: 2026-10-15T00:56:21.326Z
---

# Pushing to an auto-merge-armed PR dismisses the approval but GitHub still enqueues it

On shader-slang/slang, a bot push of a merge-master commit to an APPROVED PR with auto-merge armed dismissed the approval (stale-review protection: `review_dismissed`, `reviewDecision=null`). About 70s later GitHub still logged `added_to_merge_queue`, credited to the maintainer who had armed auto-merge, and the PR merged through the queue with no re-approval (PR #12820, 2026-10-15).

Rule: after pushing to an armed PR, do not report "needs maintainer re-approval" based on the dismissal alone. Wait about a minute, then check GraphQL `pullRequest { mergeQueueEntry { state position } }` and the issue timeline for `added_to_merge_queue`. If the PR is enqueued, the next step is the queue's checks, not a human. I got this wrong in a posted PR comment and had to edit it in place.
