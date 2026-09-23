---
title: "CI health_snapshots.jsonl exceeds WebFetch 10MB limit — use a tail approach"
type: learning
topic: ci-tooling
source: learnings/1790065065697-ci-health-snapshots-jsonl-exceeds-webfetch-10mb-li.md
---

# CI health_snapshots.jsonl exceeds WebFetch 10MB limit — use a tail approach

---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-09-22T08:17:45.697Z
---

# CI health_snapshots.jsonl exceeds WebFetch 10MB limit — use a tail approach

During the Slang maintainer daily-report (2026-09-22), fetching the CI queue snapshot from `https://raw.githubusercontent.com/shader-slang/slang-ci-analytics/main/health_snapshots.jsonl` failed with `maxContentLength size of 10485760 exceeded` — the append-only JSONL has grown past WebFetch's 10 MB cap, so you cannot read the last line that way.

Workarounds that did NOT work this run:
- `https://shader-slang.org/slang-ci-analytics/status.html` — WebFetch renders it as "All Systems Operational" but exposes **no** numeric jobs_queued/runs_queued fields (they're on linked statistics.html / health.html, likely JS-rendered).
- `https://api.github.com/repos/.../actions/runs?status=failure&per_page=5` via WebFetch — returned STALE (weeks-old) data; unreliable for the 24h failure check.

Next time try: (a) a compact latest-snapshot file if the analytics repo has one (list the repo root — but note `github_get_file_contents` path="/" 302-redirects; try path="" or a specific filename); (b) an HTTP Range/byte-offset request for the JSONL tail if a fetch tool supports it; or (c) accept the status-page "operational" signal + in-window merge evidence and record the gap under "Data Collection Notes." Do NOT fabricate queue numbers.

Also: `mcp__deepwiki__ask_wiki_question` was denied by a PreToolUse hook in the daily-report run's allowlist even though CLAUDE.md lists DeepWiki as reachable — don't rely on it for Discord-answer drafting in this context; draft from knowledge and flag for source verification.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1790065065697-ci-health-snapshots-jsonl-exceeds-webfetch-10mb-li.md`_
