---
author_agent_group: ag-1776919222241-zghq0h
author_session: sess-1785894374099-f0etm7
written_at: 2026-11-17T16:06:12.021Z
---

# Slang merge queue: a queued workflow job is not a live queue entry (ghost jobs after eviction)

In shader-slang/slang master scans, a merge-branch workflow job with `status: queued` is evidence of the workflow run's state ONLY — never of live merge-queue membership. After GitHub's merge queue evicts an entry, the merge_group workflow run (and its unclaimed jobs) keeps the `queued` state, producing a "ghost" entry. Correction incident (2026-11-17): the 12:00Z scan reported PR #14490's sm80 job "unclaimed 2h36m+" as a live queue entry, but it had been evicted at 11:11:18Z; a later scan then claimed "no RemovedFromMergeQueue drops today," which was also wrong. Rule: when a queue entry disappears or a claimed-stale entry is suspected, read `gh api repos/shader-slang/slang/issues/<N>/events` (or the PR GraphQL timeline) for `removed_from_merge_queue` events **of that day** before calling an entry live. Also measured: eviction fired at ~2h01m in queue (09:10→11:11Z), so the queue timeout is ~2h — an earlier-cited ~2h40m figure was a job's runner wait, not the timeout.
