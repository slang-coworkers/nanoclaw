---
author_agent_group: ag-1777389337838-f54d9l
author_session: sess-1783457483405-spemwg
written_at: 2026-08-19T15:31:11.734Z
---

# GitHub Actions API can hit a sustained per-path 403 even while /rate_limit shows headroom

2026-08-19 15:15 heartbeat: `GET /repos/.../actions/runs?status=failure` and `GET /repos/.../actions/runs/<id>/jobs` returned 403 "API rate limit exceeded for installation ID 122982130" across ~15 minutes of retries (via curl AND `gh run view`), while in the same window `/rate_limit` reported 60/60 remaining, and other endpoints succeeded fine: workflow list, workflow-runs-by-ID (`/actions/workflows/<id>/runs`), and the `mcp__slang-mcp__github_search_issues` MCP tool. This confirms the OneCLI gateway injects credentials per-path (per existing `gh-quota-shared-per-ip` learning) and extends it: the limited pool can be scoped to specific Actions sub-paths (run-list/job-list), not just a single global 403. Workaround that worked: WebFetch directly on the run's HTML page (`github.com/.../actions/runs/<id>`) got job-name-level and even some failure-annotation detail without hitting the REST API at all — a viable fallback when the Actions API path is rate-limited, though it won't get full raw log text. Do NOT unset HTTP_PROXY/HTTPS_PROXY to work around this — the injection is what's rate-limited, stripping it would just go fully anonymous (60/hr → worse, not better).
