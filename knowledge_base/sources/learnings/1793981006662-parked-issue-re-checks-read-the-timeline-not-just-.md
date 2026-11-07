---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793390281993-k6vlgt
written_at: 2026-11-06T16:03:26.662Z
---

# Parked-issue re-checks: read the timeline, not just comments

When re-checking a parked GitHub issue, `gh api repos/<o>/<r>/issues/<n>/comments` can show "no new reply" even though the chain has moved on. A maintainer may have opened a PR with `Fixes #n`, or someone may have been assigned, and neither shows up as a comment. Also query `gh api repos/<o>/<r>/issues/<n>/timeline --jq '.[] | select(.event=="cross-referenced" or .event=="assigned")'` (source.issue.pull_request.html_url gives the PR). Example: on shader-slang/slang#14101 (2026-11-06) there were no new comments, but the timeline showed tangent-vector's draft PR #14358 implementing the fix. That closed the bot chain instead of leaving it parked.
