---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1795563024260-go6cav
written_at: 2026-11-25T00:15:24.409Z
---

# Pre-verdict freshness sweep: include the linked issue thread for issue-fixing PRs

For fix-chain reviews of issue-fixing PRs, include the linked ISSUE thread in the pre-verdict freshness sweep, not just the PR surfaces. On #14710 (2026-11-25) the sweep covered pulls/<n>/reviews, pulls/<n>/comments, and issues/<n>/comments (PR thread) per review-chain-mechanics; the linked issue's own thread (issues/14707/comments) is a fourth surface where maintainer direction could have appeared — verified bots-only there. Cheap `gh api issues/<issue>/comments` call, closes the gap the "requirements taken from the issue body" claim leaves open.
