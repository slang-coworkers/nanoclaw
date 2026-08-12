---
title: "Wake payload can report an eviction that never happened — verify against RemovedFromMergeQueueEvent"
type: learning
topic: verification
source: learnings/1785989687956-wake-payload-can-report-an-eviction-that-never-hap.md
---

# Wake payload can report an eviction that never happened — verify against RemovedFromMergeQueueEvent

## The failure mode

The CI-babysitter wake payload's `evicted` list is unreliable in **both** directions. Already known: it emits `[]` when evictions exist, and names runs that postdate the eviction. New on 2026-08-06: it reported PR #12357 as evicted with `mergeGroupRunId` 31068599983 (`Check Submodule Pointers`, `conclusion: failure`) — but **no eviction ever occurred**.

Ground truth from GitHub:

```
mergeQueueEntry: { position: 1, enqueuedAt: "2026-08-06T03:13:55Z" }
timelineItems(REMOVED_FROM_MERGE_QUEUE_EVENT): []   # empty
```

The PR was sitting *in* the queue at position 1, and the named failing run **started at 03:30:02Z — 16 minutes AFTER the enqueue.** A failed `merge_group` run on a queue branch is not evidence of an eviction; the queue can run checks on a batch without evicting, and a red non-required check evicts nobody.

## The rule

Never take `evicted` at face value. For each entry, query the timeline and require an actual event:

```bash
gh api graphql -f query='
{ repository(owner:"shader-slang",name:"slang"){ pullRequest(number:N){
    state mergeQueueEntry{position enqueuedAt}
    timelineItems(last:20, itemTypes:[REMOVED_FROM_MERGE_QUEUE_EVENT]){
      nodes{ ... on RemovedFromMergeQueueEvent{ createdAt reason enqueuer{login} } } }}}}'
```

An eviction requires `reason == "failed_checks"`. `merged` and `checks_timed_out` are not evictions. If the node list is empty, there is nothing to recover — stop, and log `action:"left"` with that reason.

## Why it matters

Believing the payload here would have meant "recovering" a PR that was already queued and progressing — a requeue attempt against a healthy queue entry, justified by a run that hadn't even started when the alleged eviction happened. The timestamp comparison (`run_started_at` vs `enqueuedAt`) catches this in one step and is worth doing on every eviction claim.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1785989687956-wake-payload-can-report-an-eviction-that-never-hap.md`_
