# A green PR head and a failed_checks eviction are not contradictory — check beforeCommit, not the head

## The trap

You verify a PR's head checks: green (or the only red is a superseded phantom). You also have a `RemovedFromMergeQueueEvent` with `reason=failed_checks`. These look mutually exclusive, so one of them must be wrong — and the tempting move is to doubt the eviction, especially if you found it by a derivation you already distrust.

Both are true. **They describe different commits.**

Observed 2026-08-05 on shader-slang/slang#12363:

| surface | sha | state |
|---|---|---|
| PR head | `30de5b162fa` | only red is a phantom `check-pr-label` (failure 09:15:14Z, success 09:15:28Z) |
| **merge-group commit** = `beforeCommit` | `7ea596ef3cf` | **real** `test-compile-regression` failure, exit 255 |

The merge-group commit is a *distinct merge commit* (its own parent, its own message `… (#12363)`) — the PR batched onto master. It exercises a surface the head never does. A failure there evicts the PR while leaving every head check green.

This is precisely why a merge-queue babysitter needs an eviction feed at all: **after an eviction, the PR's own head checks stay green, so the PR looks healthy.** "Head is green" is therefore not evidence against an eviction — it is the *expected* post-eviction state.

## What to do

Take the eviction's commit from **`RemovedFromMergeQueueEvent.beforeCommit.oid`** and query check-runs *and* statuses on **that** sha.

⛔ Never take it from the `gh-readonly-queue/<base>/pr-<N>-<sha>` branch name: **that trailing sha is the BASE**, green by construction — it yields a confident false negative.

```
gh api graphql -f query='{repository(owner:"O",name:"R"){pullRequest(number:N){
  timelineItems(last:100,itemTypes:[REMOVED_FROM_MERGE_QUEUE_EVENT]){
    nodes{... on RemovedFromMergeQueueEvent{createdAt reason beforeCommit{oid}}}}}}}'
```

`reason == "failed_checks"` is an eviction; `merged` and `checks_timed_out` are not.

## Corroborate with ordering — it is free and it is decisive

Compare the head's red against `AddedToMergeQueueEvent`. On #12363 the phantom pair sat **4.8h before** the enqueue (11:29:53Z), so GitHub enqueued the PR *after* it resolved — the head red provably could not have caused a 14:01:51Z eviction. Ordering settles attribution without reading a single log.

Corollary: **never attribute an eviction to a cause that postdates it.**

## The meta-lesson

When two of your own verified findings appear to contradict, the likeliest resolution is that they are measurements of **different objects**, not that one is false. Name the object each fact is about — here, the sha — before discarding either. Reporting both in one message without naming the surfaces is what made a correct pair read as self-contradiction to a reviewer.
