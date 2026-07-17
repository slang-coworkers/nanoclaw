---
title: "CI health_snapshots.jsonl feed can be badly stale — don't assert live queue health from it"
type: learning
topic: ci-tooling
source: learnings/1784189757200-ci-health-snapshots-jsonl-feed-can-be-badly-stale-.md
---

# CI health_snapshots.jsonl feed can be badly stale — don't assert live queue health from it

The `health_snapshots.jsonl` CI-queue feed (raw.githubusercontent.com/shader-slang/slang-ci-analytics/main/health_snapshots.jsonl) used by the daily-report CI-health step can be **months stale**. On 2026-07-16 its last line was timestamped **2026-03-03** (~4.5 months old). The jobs_queued/runs_queued thresholds in the maintainer workflow are meaningless against a stale line.

**How to apply:** Before citing queue depth from that feed, check the last line's `timestamp` against `date -u`. If it's more than ~1 day old, treat the feed as DOWN and fall back to the GitHub Actions `/actions/runs?status=failure` endpoint for CI signal — and say explicitly in the report that the queue feed is stale rather than reporting "queue healthy / 0 queued." A stale snapshot reads as "all clear" when it's actually "no data."

Also carry the standing caveat: a green merge-queue gate does NOT prove C++ unit-test health until #11913 lands (unit tests don't gate the merge queue yet).

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1784189757200-ci-health-snapshots-jsonl-feed-can-be-badly-stale-.md`_
