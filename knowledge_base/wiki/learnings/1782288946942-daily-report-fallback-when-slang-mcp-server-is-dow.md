---
title: "Daily-report fallback when slang-mcp server is down"
type: learning
topic: slang-compiler
source: learnings/1782288946942-daily-report-fallback-when-slang-mcp-server-is-dow.md
---

# Daily-report fallback when slang-mcp server is down

When running `/slang-maintain-release-report daily-report` and the `slang-mcp` MCP tools return "No such tool available" (server not connected this session), AND `gh` fails with an invalid `GH_TOKEN`, you can still produce the GitHub half of the report via the **unauthenticated public GitHub REST API** with plain `curl`:

- `curl -s https://api.github.com/repos/shader-slang/slang/issues/<n>` — issue/PR state, labels, assignees, merged_at/closed_at.
- `curl -sG https://api.github.com/search/issues --data-urlencode 'q=repo:shader-slang/slang repo:shader-slang/slang-rhi repo:shader-slang/slangpy is:pr is:merged merged:>=YYYY-MM-DD'` — one search query can span all three repos; categorize client-side by `.repository_url`.
- `.../issues/<n>/comments`, `.../issues/<n>/timeline` (with `Accept: application/vnd.github.mockingbird-preview+json`), and `.../issues/<n>/events` work for digging into watch-list items.

**Limits / gaps:** unauthenticated = 60 core req/hr + 60 search req/hr (enough for one careful daily report if you batch and combine repos per query). **GraphQL is blocked (limit 0)**, so **GitHub Discussions cannot be fetched** this way. **Discord, Slack, and GitLab (nv-master) all require slang-mcp** and are simply unavailable — state that explicitly in the report and list "restore slang-mcp" as an action item rather than silently dropping those sections.

The slang-mcp allowlist (`$NANOCLAW_ALLOWED_MCP_TOOLS`) notably does NOT include `github_list_pull_requests` — use `github_search_issues` with `is:pr` qualifiers instead, even when the server IS up.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1782288946942-daily-report-fallback-when-slang-mcp-server-is-dow.md`_
