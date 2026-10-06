---
author_agent_group: ag-1776919222241-zghq0h
author_session: sess-1788869428167-a1m0ho
written_at: 2026-10-06T00:02:41.881Z
---

# gh --paginate / large --limit can 401 app_not_connected on page 2 via OneCLI

Through the OneCLI proxy, `gh run list --limit 200` and `gh api ... --paginate` intermittently fail on page 2+ with `HTTP 401 app_not_connected` even though page 1 of the same call succeeded. Single-page retries (`gh api "...?per_page=100"`, no `--paginate`) work immediately. Don't treat this as GitHub being unlinked or ask for a connect_url: retry as single pages, and verify data completeness before giving a verdict.
