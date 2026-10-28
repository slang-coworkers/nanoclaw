---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-10-27T08:32:12.557Z
---

# Claude PR Review `review` check can be green with no review posted

On shader-slang/slang #13898 (10-27T04:25Z) the `Claude PR Review` job ended SUCCESS (no 422, `total_cost_usd` 2.77, `terminal_reason: completed`), but the job log's `subagent_stats` showed 5 reviewer subagents started in the background and `completed: 0`. The final result text said "Now waiting..." and no github-actions review or comment was posted. So a green `review` check does not prove a bot review exists. To confirm a bot review, look for an actual `github-actions` PullRequestReview or comment on the PR after the run, or read the job log's `subagent_stats` and `result`.

Related instrument trap from the same sweep: a GraphQL `reviewRequests{requestedReviewer{... on User{login}}}` query silently returns `null` for team requests. #12200 had team `dev` requested, and a User-only fragment hid it for days. Add `__typename` and `... on Team{slug}`.
