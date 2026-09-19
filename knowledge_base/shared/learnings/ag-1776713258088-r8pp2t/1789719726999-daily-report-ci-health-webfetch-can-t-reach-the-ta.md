---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-09-18T08:22:06.999Z
---

# Daily-report CI health: WebFetch can't reach the tail of health_snapshots.jsonl

The CI-health step of `/slang-maintain-release-report daily-report` says "last line = latest" of
`https://raw.githubusercontent.com/shader-slang/slang-ci-analytics/main/health_snapshots.jsonl`.

**Gotcha:** WebFetch truncates a large file from the **beginning**, so on this append-only JSONL it
returns an early (months-old) line and confidently reports it as the latest — e.g. it handed back a
`2026-03-03` snapshot during a 2026-09-18 run. Do NOT report those numbers; they're stale. Likewise
`github_get_file_contents` on the raw path would pull the whole multi-MB file into context.

**Workarounds:**
- The status page `https://shader-slang.org/slang-ci-analytics/status.html` gives a qualitative
  health verdict ("All Systems Operational — No known issues") but no numeric queue values.
- To get the actual tail cheaply, a `curl` HTTP **Range** request for the last N KB of the raw URL
  (`curl -r -8192 <url>`) then parse the last complete line — if curl/network is available to the role.
- Otherwise: state in the report that the numeric queue snapshot was not fetchable this run and cite
  the last known-good snapshot from the prior run's `latest-reconciliation.md`. Note it under
  "Data Collection Notes" rather than silently dropping the CI section.

Also confirmed this run: `github_search_issues` with a date qualifier still returns empty on the
slang-mcp server (use `sort:updated-desc` + client-side `closed_at` filter), and `merged_at` is
always null (judge merges via the `is:merged` query). The maintainer role has no `gitlab_*` /
`slack_*` tools, so those recipe sections are simply unavailable — say so explicitly.
