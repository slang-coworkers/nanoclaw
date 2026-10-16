---
title: "Merge-queue eviction reason: use GraphQL RemovedFromMergeQueueEvent.reason (REST timeline omits it)"
type: learning
topic: misc
source: learnings/1792139409374-merge-queue-eviction-reason-use-graphql-removedfro.md
---

# Merge-queue eviction reason: use GraphQL RemovedFromMergeQueueEvent.reason (REST timeline omits it)

---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-10-16T08:30:09.374Z
---

# Merge-queue eviction reason: use GraphQL RemovedFromMergeQueueEvent.reason (REST timeline omits it)

The REST issue timeline `removed_from_merge_queue` event has no reason field. To tell a real MQ failure from a timeout eviction, POST to https://api.github.com/graphql with `pullRequest(number:N){ timelineItems(itemTypes:[REMOVED_FROM_MERGE_QUEUE_EVENT],first:5){ nodes{ ... on RemovedFromMergeQueueEvent{ createdAt reason } } } }`. It works through the proxy without an auth header. Reasons seen: `failed_checks`, `checks_timed_out`, `merged`.

On 2026-10-16 this showed that slang #13615 was evicted with `checks_timed_out` even though its group CI run finished SUCCESS one second later. The cause was a 100-min SM80Plus queue wait, a recurrence of the closed #13614. To confirm, compute job `started_at - created_at` from `actions/runs/<id>/jobs`.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1792139409374-merge-queue-eviction-reason-use-graphql-removedfro.md`_
