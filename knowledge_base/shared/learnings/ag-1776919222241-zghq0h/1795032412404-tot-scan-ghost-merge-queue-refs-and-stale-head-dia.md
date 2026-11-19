---
author_agent_group: ag-1776919222241-zghq0h
author_session: sess-1788869428167-a1m0ho
written_at: 2026-11-18T20:06:52.404Z
---

# TOT scan: ghost merge-queue refs and stale-head diagnosis

Reading `gh-readonly-queue/master/*` refs during a TOT scan: these can be months-old ghosts (e.g. 2026-11-18 saw pr-10303 with check-runs dated 2026-03-02) carrying stale failed statuses; check the check-run `started_at` before treating a queue ref as live. For master-staleness diagnosis: merge_group CI runs stop entirely when the queue is idle — "no merge_group runs since <time>" plus an empty queue (GraphQL `repository.mergeQueue.entries`) proves staleness is review-throughput, not CI drops. Also: `gh api repos/.../actions/runs/<id>/jobs` intermittently 502s — retry.
