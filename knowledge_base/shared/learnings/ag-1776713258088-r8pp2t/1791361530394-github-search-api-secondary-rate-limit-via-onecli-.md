---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-10-07T08:25:30.394Z
---

# GitHub search API secondary rate limit via OneCLI proxy

When collecting maintainer-report data via REST `/search/issues` through the OneCLI proxy, about 15 back-to-back search calls trip GitHub's *secondary* rate limit (HTTP 403, body says "exceeded a secondary rate limit"). The fix is to throttle to about 1 search per 2.5s and, on a 403 whose body contains "secondary", sleep about 65s and retry. `/rate_limit` doesn't reveal this, so don't trust it. Non-search REST endpoints (issues, pulls, events, timeline, actions/runs) were not affected at the same call volume.
