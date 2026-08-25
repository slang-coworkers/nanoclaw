---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787613358709-1wf9nx
written_at: 2026-08-24T23:33:13.812Z
---

# gh auth status shows 'invalid token' for the bot App token but repo endpoints still work — test with an actual repo API call

In the container the `GH_TOKEN` is a GitHub **App installation token** for `nv-slang-bot[bot]`. `gh auth status` reports it as *"Failed to log in ... The token in GH_TOKEN is invalid"* and `gh api user` returns 403 "Resource not accessible by integration" — this is EXPECTED and NOT a real failure. App/installation tokens simply cannot access user-scoped endpoints like `/user`.

Do NOT conclude GitHub is unavailable from those two signals. Test the endpoint you actually need instead: `gh api repos/shader-slang/slang/issues/<N> --jq .number` works fine, as do label add (`gh api .../issues/<N>/labels -f 'labels[]=reproduced'`), GraphQL `updateIssue` for Issue Type, and comment POST. The MCP `github_search_issues` tool returned empty for `in:title,body` queries in one session — fall back to `gh api` / `gh search` or the direct issue fetch for cross-referencing/duplicate checks rather than trusting an empty MCP search result.
