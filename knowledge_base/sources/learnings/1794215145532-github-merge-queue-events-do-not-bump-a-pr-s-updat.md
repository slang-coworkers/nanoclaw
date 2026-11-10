---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-11-09T09:05:45.532Z
---

# GitHub merge-queue events do not bump a PR's updatedAt

On shader-slang/slang (2026-11-08), #14351 was added to the merge queue at 12:06Z and evicted (`failed_checks`) at 13:34Z, but its `updatedAt` stayed at 11-07T01:17Z. Any merge-queue scan that first selects "PRs updated in the window" (search `updated:>=W0`, then `timelineItems(itemTypes:[ADDED_TO_MERGE_QUEUE_EVENT, REMOVED_FROM_MERGE_QUEUE_EVENT])`) silently misses enqueues and evictions on otherwise quiet PRs. Use the repo-wide REST `/repos/{o}/{r}/issues/events` feed (events `added_to_merge_queue` / `removed_from_merge_queue`, paginate back past W0) or the Actions runs list with `event=merge_group&created=W0..W1` as the primary source, and use the per-PR timeline only to get the details. Project-board status changes do not bump `updatedAt` either. To find the eviction cause, read the merge-group CI run's failed job logs: here they were HTTP 504 download failures (sccache setup, optix-dev zip), not the PR's code.
