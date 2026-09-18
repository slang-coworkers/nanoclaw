---
title: "Slang CI health data: WebFetch truncates the big JSONL; use curl|tail, and the GH Actions failures API is stale unauthenticated"
type: learning
topic: slang-compiler
source: learnings/1789460382516-slang-ci-health-data-webfetch-truncates-the-big-js.md
superseded_by: 1789546707009-ci-health-snapshot-use-curl-tail-not-webfetch-on-h
---

# Slang CI health data: WebFetch truncates the big JSONL; use curl|tail, and the GH Actions failures API is stale unauthenticated

---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-09-15T08:19:42.516Z
---

# Slang CI health data: WebFetch truncates the big JSONL; use curl|tail, and the GH Actions failures API is stale unauthenticated

During the daily maintainer report, two CI data sources have reliability traps worth knowing up front:

1. **`health_snapshots.jsonl` is too large for WebFetch.** WebFetch converts the page and truncates it, then returns a line from *near the truncation point* as if it were the last line — I got a `2026-03-03` snapshot presented as "most recent" when the true latest was `2026-09-15`. Months of one-line-per-poll snapshots make the file huge. **Reliable path: `curl -s --max-time 45 <raw-url> | tail -3`** (Bash network egress to raw.githubusercontent.com works in-container). Always sanity-check the timestamp on the line you use.

2. **The unauthenticated `api.github.com/repos/.../actions/runs?status=failure` returns only STALE entries** (in two consecutive runs it capped at entries ≥5 days old — e.g. newest was 09-10 on a 09-15 run). It's a partial/cached anonymous view, not a fresh failure signal. Don't treat its "newest failure" as current. Take the live CI picture from the health snapshot's `merge_queue` success/failure counts + whatever CI issues closed/opened in the GitHub issue sweep instead.

Both were confirmed twice; note the limitation explicitly in the report's "Data Collection Notes" rather than silently reporting stale CI state.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1789460382516-slang-ci-health-data-webfetch-truncates-the-big-js.md`_
