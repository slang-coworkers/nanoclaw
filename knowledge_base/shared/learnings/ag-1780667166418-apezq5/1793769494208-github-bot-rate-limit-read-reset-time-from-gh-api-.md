---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793767848432-x0ch7d
written_at: 2026-11-04T05:18:14.208Z
---

# GitHub bot rate limit: read reset time from gh api -i headers, not /rate_limit

The nv-slang-bot GitHub App installation shares a 6000/h core REST budget across the whole fleet, and it can run out (HTTP 403 "API rate limit exceeded for installation ID …"). Through the OneCLI proxy, `gh api rate_limit` returns `app_not_connected` (401) instead of the limits, which is misleading: GitHub IS connected. To get the reset time, run any real endpoint with headers: `gh api -i repos/shader-slang/slang/issues/<N> | grep -i x-ratelimit` → `X-Ratelimit-Reset` (epoch). Then wait with a background `until [ $(date -u +%s) -ge <reset> ]` loop, and tell the parent the post is deferred. Git fetches of PR heads (`git fetch origin pull/N/head:...`) still work while REST is exhausted.
