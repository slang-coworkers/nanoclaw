---
title: "slang-mcp degraded: use unauth GitHub REST fallback for daily report"
type: learning
topic: slang-compiler
source: learnings/1784276460761-slang-mcp-degraded-use-unauth-github-rest-fallback.md
---

# slang-mcp degraded: use unauth GitHub REST fallback for daily report

> ⚠️ **SUPERSEDED 2026-07-17** — This described a transient migration credential regression (token-refresh cron silently died: gh missing on the new host → set -euo pipefail aborted before the onecli secret updates → App token expired hourly). FIXED: gh 2.96 installed on prod+lego, cron guarded, github.com App-token secrets refresh; git-push split into /shader-slang/slang* (App) + /slang-coworkers/<repo>* (USER PAT) non-overlapping secrets. Verified: actions total_count=40000, GraphQL OK, both git-push targets OK. **Do NOT treat GitHub auth/actions/GraphQL/git-push as down.** The diagnostic *techniques* below remain useful; the outage itself is resolved.

On 2026-07-17 the `slang-mcp` MCP server was partially degraded during the daily maintainer report: `github_list_issues`, `github_search_issues`, and `github_get_discussions` all returned empty result sets or `Upstream MCP server unavailable`, and every `discord_read_messages` call returned `{messages: [], total_count: 0}`. Only `mcp__slang-mcp__github_get_issue` (single-issue fetch) still worked.

**Key trap:** the broken list/search tools return `{"issues": [], "total_count": 0}` — a *successful-looking empty response*, NOT an error. shader-slang/slang always has open issues, so total_count:0 across all three repos is a tool-malfunction signal, not "zero new issues." Don't report "no new issues" off an empty list result — cross-check.

**Working fallback (no auth needed):** the unauthenticated GitHub REST API returns real data for issues/PRs/actions:
- Issues: `curl -s "https://api.github.com/repos/shader-slang/slang/issues?state=open&sort=created&direction=desc&per_page=40"` (filter out entries with a `pull_request` key; they're PRs).
- Merged PRs: `curl -s ".../pulls?state=closed&sort=updated&direction=desc&per_page=50"`, keep `merged_at` in window.
- CI failures: `.../actions/runs?status=failure&per_page=10`, then `.../actions/runs/<id>/jobs` for failed-step names.
- CI health snapshot: `curl -s https://raw.githubusercontent.com/shader-slang/slang-ci-analytics/main/health_snapshots.jsonl | tail -1` (has current gpu_quota + merge_queue + hosted_runner_usage fields the skill doc doesn't list).

**Not recoverable unauth:** GitHub Discussions (GraphQL-only, needs a token) and Discord (needs the MCP server). Note `gh` CLI's `GH_TOKEN` was ALSO invalid this run, so `gh api` didn't help either. When both are down, the daily report's Discord + Discussions sections must be flagged as "not checked" and carried, and the operator should be told to fix the MCP server / token.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1784276460761-slang-mcp-degraded-use-unauth-github-rest-fallback.md`_
