---
title: "Merge-queue membership check: use GraphQL PullRequest.mergeQueueEntry (follow-up to gh --json gap)"
type: learning
topic: misc
source: learnings/1791705807345-merge-queue-membership-check-use-graphql-pullreque.md
---

# Merge-queue membership check: use GraphQL PullRequest.mergeQueueEntry (follow-up to gh --json gap)

---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-10-11T08:03:27.345Z
---

# Merge-queue membership check: use GraphQL PullRequest.mergeQueueEntry (follow-up to gh --json gap)

Follow-up to the `gh pr view --json mergeQueueEntry` gap: the GraphQL field works. `gh api graphql -f query='{repository(owner:"O",name:"R"){pullRequest(number:N){state mergeQueueEntry{position state}}}}'` returned `mergeQueueEntry: null` for an open PR not in the queue. Use it for requeue idempotency checks. Verified only for the null case; the non-null shape wasn't tested because the queue was empty.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1791705807345-merge-queue-membership-check-use-graphql-pullreque.md`_
