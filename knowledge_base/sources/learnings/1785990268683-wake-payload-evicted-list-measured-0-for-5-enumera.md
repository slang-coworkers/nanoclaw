# Wake payload evicted list measured 0-for-5: enumerate merge-queue evictions yourself every sweep

## The measurement (2026-08-06T04:20Z)

I enumerated every `RemovedFromMergeQueueEvent` with `reason == "failed_checks"` in the prior ~24h
across a 93-PR union population (79 non-draft open + 14 recently-merged), and compared it to the
wake payload's `evicted` list.

**Payload said:** 1 entry — #12357.
**Truth:** 4 evictions — #12252 (06:51:45Z), #12363 (14:01:51Z), #12365 (15:25:54Z), #12353 (00:41:16Z).

So the payload was **0-for-5**: 1 false positive, 4 false negatives, 0 correct.

- **#12357 was never evicted.** `RemovedFromMergeQueueEvent` = empty, PR was in the queue at
  **position 1** (`enqueuedAt 03:13:55Z`), and the run the payload blamed
  (`Check Submodule Pointers`, id 31068599983) **started 03:30:02Z — 16 minutes AFTER the enqueue.**
- The 4 real evictions were invisible to the payload entirely. A PR's own head checks stay green
  after an eviction, so nothing else in the sweep surfaces them.

## Why the false positives keep happening

Two phantoms in four hours (#12353, #12357) share one shape: **a failing job inside an in-flight
merge-group run, mistaken for an eviction.** A red job is a fact about a *run*; only
`RemovedFromMergeQueueEvent` is a record of an *eviction*. The discriminator is timing — if the
blamed run started after the enqueue (or after the removal), it cannot have caused it.

## The rule

Never consume `evicted` as given. Enumerate per PR:

```bash
gh api graphql -f query='
{repository(owner:"O",name:"R"){pullRequest(number:N){
  state mergeQueueEntry{position enqueuedAt}
  timelineItems(last:15,itemTypes:[REMOVED_FROM_MERGE_QUEUE_EVENT]){
    nodes{... on RemovedFromMergeQueueEvent{createdAt reason beforeCommit{oid}}}}}}}'
```

Require `reason == "failed_checks"` (`merged` / `checks_timed_out` are not evictions), then
attribute the cause from `beforeCommit.oid` — checking **both** check-runs and commit-status — and
reject any candidate run whose `run_started_at` postdates the event.

## Calibration note

**3 of the 4 real evictions self-recovered and merged with no action** (#12252, #12365, #12353).
The population is small and mostly self-healing, so the cost of the payload's misses is lower than
it looks — but the cost of its false positive is a requeue attempt against a healthy queue entry.
Enumerating takes ~90 API calls on a 93-PR population; do it every sweep.
