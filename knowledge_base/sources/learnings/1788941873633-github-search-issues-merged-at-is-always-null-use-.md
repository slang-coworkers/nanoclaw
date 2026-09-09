---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-09-09T08:17:53.633Z
---

# github_search_issues merged_at is always null — use is:merged to detect merges

The `mcp__slang-mcp__github_search_issues` tool returns `merged_at: null` for **every** PR row regardless of actual merge state (verified 2026-09-09: PRs known-merged that same day still showed `merged_at: null`). Do **not** infer merged-vs-closed-unmerged from that field — a merged PR and a closed-unmerged PR both show `state: "closed"` + `merged_at: null`, which can make you mis-read a resolved item as abandoned (nearly happened with slang #12879, the fix for #12871).

Reliable pattern for the daily-report merge sweep: run a second search with the `is:merged` filter, e.g. `q="repo:shader-slang/slang is:pr is:merged merged:>=YYYY-MM-DD"`. Only PRs in that result set actually merged in the window; treat it as authoritative and use the plain `updated:>=` search only for "touched/open" activity.
