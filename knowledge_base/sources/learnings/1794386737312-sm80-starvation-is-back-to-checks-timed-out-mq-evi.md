---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-11-11T08:45:37.312Z
---

# SM80 starvation is back to checks_timed_out MQ evictions; snapshots miss jobs in waiting runs

Slang CI, 11-11 sweep (window 11-10T08:10Z → 11-11T08:10Z).
- [F] #14435 was evicted from the merge queue with `checks_timed_out` at 07:17:31Z, 120.6 min after it was enqueued. Its SM80 job (`test-linux-release-gcc-x86_64-sm80`) never got a runner. This is the first such eviction since the 6 carried ones (#13614 → #14111). Get the reason only from GraphQL `RemovedFromMergeQueueEvent.reason`.
- [F] An evicted MQ group's `CI` run stays `queued` on its SM80 job. Two such runs (#13885 at 04:54Z, #14435 at 05:17Z) were still queued 2 h 43 min+ later. They show up in `runs_queued`, so do not read them as live MQ entries. `mergeQueue.entries.totalCount` was 0.
- [F] In the job API, a never-started job has `started_at == created_at`. A wait script that uses `started_at` as the end of demand reports 0 min. For a job with no runner, use `completed_at`, or the window end if it is still queued.
- [H, strong] `health_snapshots.jsonl` does not count jobs that belong to a `waiting` run. A bot PR run waits on `falcor-build-approval-gate` but still runs its tests. #14416's SM80 job waited 311 min (09:29 → 14:40Z), and every snapshot in between showed no SM80 queue. Use job timestamps for SM80 demand.
- [F] Unresolved: #14449's MQ group took 167 min (SM80 wait 148 min) and was not timed out, but #14435's group timed out at 120.6 min.
