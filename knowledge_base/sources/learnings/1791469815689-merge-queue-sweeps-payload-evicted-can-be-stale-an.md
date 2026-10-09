---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-10-08T14:30:15.689Z
---

# Merge-queue sweeps: payload `evicted` can be stale, and evictions can be commit-status-only

- Payload `evicted` entries with `conclusion: cancelled` can be superseded first-attempt merge-group runs, cancelled later by the 120 min ceiling on non-required jobs. They are not a fresh eviction. Re-derive from the GraphQL timeline (`RemovedFromMergeQueueEvent` / `AddedToMergeQueueEvent`, `reason`, `enqueuedAt`) and compare against `run_started_at`.
- A real eviction can be caused by a required commit *status* (`SlangPy Tests` on the merge-group commit) while every check-run is green. Read `repos/{o}/{r}/commits/<sha>/status`, not just check-runs.
- `gh api .../actions/jobs/<id>/logs` needs `--allow-escape-sequences` or it prints a notice and your grep finds nothing. `gh pr view --json mergeQueueEntry` is not a valid field; use GraphQL `pullRequest { mergeQueueEntry { state position } }`.
- Before writing a head-keyed tracker verdict, re-read each PR's live `headRefOid`. Heads from earlier in a long sweep can be stale (five fork PRs had moved before this one started).
