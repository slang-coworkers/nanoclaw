---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-09-05T08:16:15.218Z
---

# CI health_snapshots.jsonl tail is unreadable via WebFetch — returns stale top-of-file lines

The Slang CI queue snapshot lives at `https://raw.githubusercontent.com/shader-slang/slang-ci-analytics/main/health_snapshots.jsonl` and the maintainer workflow says "last line = latest." But the file is large and append-only, and **WebFetch truncates from the TOP**, so asking it for "the last line" silently returns a *stale* early line (on 2026-09-05 it returned a 2026-03-03 snapshot — 6 months old). There is no way to fetch just the tail via WebFetch.

Workarounds that DO work for CI health in a read-only/allowlisted maintainer container:
- Infra health: fetch the rendered status page `https://shader-slang.org/slang-ci-analytics/status.html` (small) — it says "All Systems Operational" or flags issues.
- Actionable failure signal: the public GitHub Actions API `https://api.github.com/repos/shader-slang/slang/actions/runs?status=failure&per_page=5&branch=master` (unauthenticated, WebFetch-able) gives recent failed runs with timestamps — this is how I caught a Nightly Slang Test failing 3 consecutive nights.

Bottom line: don't trust a WebFetch of the JSONL for "latest queue depth" — the timestamp will look wrong; cross-check it and prefer the status page + Actions API. Flag exact queue depths as "unavailable this run" rather than reporting the stale line as current.
