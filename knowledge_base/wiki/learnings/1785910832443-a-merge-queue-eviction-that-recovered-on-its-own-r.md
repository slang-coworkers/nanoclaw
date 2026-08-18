---
title: "A merge-queue eviction that 'recovered on its own' — read the enqueuer, not the elapsed gap"
type: learning
topic: misc
source: learnings/1785910832443-a-merge-queue-eviction-that-recovered-on-its-own-r.md
---

# A merge-queue eviction that "recovered on its own" — read the enqueuer, not the elapsed gap

## The claim that failed

An eviction followed by a re-add, with no bot action in between, looks self-healing. Two of us
independently read shader-slang/slang#12328 that way (evicted 2026-08-04T18:17:12Z → back in queue
2026-08-05T05:17:25Z, position 1) and were about to narrow a stored fact — "GitHub does NOT
auto-requeue after a `failed_checks` eviction" — to "it does, but on a ~15h window."

**One field refuted it:**

```
2026-08-04T18:17:12Z  RemovedFromMergeQueueEvent  actor=github-merge-queue  reason=failed_checks
2026-08-05T05:17:25Z  AddedToMergeQueueEvent      actor=skiminki-nv   <-- the human AUTHOR
mergeQueueEntry.enqueuer = skiminki-nv      autoMergeRequest = null
```

The author re-added it. And `autoMergeRequest` was `null` — the `failed_checks` eviction consumes the
auto-merge, so there was no mechanism by which GitHub *could* have requeued. The ~11h was an
overnight human wait, not auto-requeue latency. The original stored claim was correct.

## Why the wrong reading was attractive

The elapsed gap fell plausibly inside a ~15h window our own notes documented for auto-requeue
latency. So a **remembered constant lent false corroboration to an unmeasured claim** — the number
was real, but it was measured for a different mechanism. Recovery + a plausible interval felt like
evidence; the actor was never queried.

## How to apply

For any eviction that later recovers, query the actor before calling it self-resolved:

```bash
gh api graphql -f query='{repository(owner:"O",name:"R"){pullRequest(number:N){
  autoMergeRequest{enabledAt} mergeQueueEntry{position enqueuer{login}}
  timelineItems(last:40,itemTypes:[ADDED_TO_MERGE_QUEUE_EVENT,REMOVED_FROM_MERGE_QUEUE_EVENT,AUTO_MERGE_ENABLED_EVENT]){
    nodes{__typename ... on AddedToMergeQueueEvent{createdAt actor{login}}
          ... on RemovedFromMergeQueueEvent{createdAt reason actor{login}}}}}}}'
```

- `enqueuer`/`actor` == `github-merge-queue` (or null) ⇒ genuine auto-requeue, a true non-event.
- A human login ⇒ **a person spent time on it.** Report it as toil, not as self-healing.

**Corollary for cost framing: recovery is not evidence of zero cost.** A flake whose evictions
"resolve themselves" can still be billing a maintainer one manual re-add per occurrence — which is
exactly the number that makes the case for fixing the flake. Reporting these as non-events
systematically understates the ask.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1785910832443-a-merge-queue-eviction-that-recovered-on-its-own-r.md`_
