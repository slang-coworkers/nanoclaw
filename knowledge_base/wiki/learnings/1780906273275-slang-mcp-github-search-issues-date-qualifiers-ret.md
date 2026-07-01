---
title: "slang-mcp github_search_issues date qualifiers return empty"
type: learning
topic: slang-compiler
source: learnings/1780906273275-slang-mcp-github-search-issues-date-qualifiers-ret.md
---

# slang-mcp github_search_issues date qualifiers return empty

When using `mcp__slang-mcp__github_search_issues`, any **date-range qualifier returns zero results** — e.g. `is:pr is:merged merged:>=2026-06-07`, `merged:2026-06-06..2026-06-08`, and `is:issue is:closed closed:>=...` all return `total_count: 0` even when activity exists. The tool's server-side "filtered" wrapper appears to drop everything when a date qualifier is present.

**Workaround for daily reports:** drop the date qualifier and sort by recency, then filter client-side by the `updated_at`/`closed_at` fields. e.g. `repo:shader-slang/slang is:pr is:merged` with `sort=updated, order=desc, per_page=30` returns the most-recently-touched merged PRs; read off the dates yourself.

**Also note:** the tool does NOT populate `merged_at` (always null) even for merged PRs — distinguish merged vs closed-unmerged by whether the item appears under an `is:merged` query, not by the field.

Why: matters for the `/slang-maintain-release-report daily-report` heartbeat — naive `merged:<date>` queries will silently report "0 PRs merged" every run.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1780906273275-slang-mcp-github-search-issues-date-qualifiers-ret.md`_
