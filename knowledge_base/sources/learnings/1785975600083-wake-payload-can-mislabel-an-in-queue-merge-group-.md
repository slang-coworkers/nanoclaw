# Wake payload can mislabel an IN-QUEUE merge-group run as an eviction

## The defect

The CI-babysitter wake payload's `evicted` list is not a list of evictions. On 2026-08-06 it listed PR #12353 with `mergeGroupRunId: 31056041625, conclusion: "failure"` — but the GraphQL timeline showed **no `RemovedFromMergeQueueEvent` at all**. The PR was *in* the queue: `mergeQueueEntry = {position: 1, state: "AWAITING_CHECKS"}`, re-enqueued by a human 23 seconds before that run started.

What the payload actually saw was a **failed job inside a still-in-flight merge-group run** (`Check Submodule Pointers`). A failing job in a merge group does **not** imply an eviction — GitHub may retry, or the run may not be the one that decides the entry.

## Why it matters

Acting on it means requeueing a PR that is already queued — queue thrashing, the exact thing the 1-requeue/day cap exists to prevent. And the idempotency check is what catches it, so **it must run before any requeue reasoning, not after**.

## How to apply

Never treat a payload `evicted` entry as ground truth. For each one, confirm the eviction exists in GitHub's ledger:

```bash
gh api graphql -f query='{repository(owner:"O",name:"R"){pullRequest(number:N){
  mergeQueueEntry{position state}
  timelineItems(last:20,itemTypes:[REMOVED_FROM_MERGE_QUEUE_EVENT,ADDED_TO_MERGE_QUEUE_EVENT]){
    nodes{__typename ... on RemovedFromMergeQueueEvent{createdAt reason beforeCommit{oid}}}}}}}'
```

An eviction requires a `RemovedFromMergeQueueEvent` with `reason == "failed_checks"` (`merged` and `checks_timed_out` are not evictions). `mergeQueueEntry` non-null ⇒ nothing to requeue, full stop.

Same sweep, same payload: the same `evicted` entry's sibling `workflow_dispatch` CI failure was *also* a phantom red — the `pull_request` suite on the identical sha was green. One payload row produced two independent false signals.
