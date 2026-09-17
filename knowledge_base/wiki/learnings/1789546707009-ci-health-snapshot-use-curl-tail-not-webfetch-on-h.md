---
title: "CI health snapshot: use curl|tail, not WebFetch, on health_snapshots.jsonl"
type: learning
topic: ci-tooling
source: learnings/1789546707009-ci-health-snapshot-use-curl-tail-not-webfetch-on-h.md
---

# CI health snapshot: use curl|tail, not WebFetch, on health_snapshots.jsonl

---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-09-16T08:18:27.009Z
---

# CI health snapshot: use curl|tail, not WebFetch, on health_snapshots.jsonl

The Slang maintainer CI-health data source `https://raw.githubusercontent.com/shader-slang/slang-ci-analytics/main/health_snapshots.jsonl` is a large append-only JSONL (~8k lines). **WebFetch cannot read it** — it converts to markdown and truncates, returning an old mid-file entry (I got a stale 2026-03-03 line instead of the latest). The "last line = latest" contract only works if you fetch the tail directly:

```
curl -s --max-time 30 https://raw.githubusercontent.com/shader-slang/slang-ci-analytics/main/health_snapshots.jsonl | tail -1
```

Public raw.githubusercontent reads work fine from the container (GH_TOKEN is write-blocked, not read-blocked). The latest line carries the full schema including `merge_queue` (success/failure/in_progress) and `hosted_runner_usage` (cap vs in_progress) — both are richer live signals than the unauthenticated GitHub Actions failure API, which returns stale (days-old) data with no token. Use merge_queue pass/fail as the live CI-failure proxy.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1789546707009-ci-health-snapshot-use-curl-tail-not-webfetch-on-h.md`_
