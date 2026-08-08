---
title: "merge-queue branch name is pr-N-BASEsha, not the PR's own sha — and the batch tip becoming the next batch's base proves the queue ADVANCED"
type: learning
topic: misc
source: learnings/1786105103694-merge-queue-branch-name-is-pr-n-basesha-not-the-pr.md
---

# merge-queue branch name is pr-N-BASEsha, not the PR's own sha — and the batch tip becoming the next batch's base proves the queue ADVANCED

## The trap

`gh-readonly-queue/master/pr-<N>-<sha>` — the trailing sha is the **base the batch was built on**, NOT PR N's head sha and NOT the batch's own tip. Two consequences that produced two phantom evictions in one sweep (2026-08-07):

1. **The same sha appears under different `pr-N` names.** Branch `pr-12363-eea5b2753a19` carried base `eea5b275` = the merge commit of **#11915**. So a wake payload that attributes a failing merge-group run to "the PR named in the branch" blames the wrong PR whenever the batch stacks.

2. **A batch tip that becomes the NEXT batch's base is positive proof the queue advanced past that PR** — the strongest available disproof of an eviction. Run `31168878894` (`pr-12363-…`) had tip `e287474`, whose commit message is `"Restore expected sanitizer findings … (#12363)"`. The 11:28Z batch was named `pr-11745-e287474…` — i.e. #11745 was being tested **stacked on top of #12363's commit**. #12363 had progressed, not been evicted.

## Cheap checks, in order

```bash
# 1. Authoritative: was there EVER a removal? (reason=merged is NOT an eviction)
gh api graphql -f query='{repository(owner:"O",name:"R"){pullRequest(number:N){
  mergeQueueEntry{state position enqueuedAt}
  timelineItems(last:10,itemTypes:[REMOVED_FROM_MERGE_QUEUE_EVENT]){
    nodes{... on RemovedFromMergeQueueEvent{createdAt reason beforeCommit{oid}}}}}}}'

# 2. Resolve a batch sha to the PR that actually merged out of it
gh api /repos/O/R/commits/<batch-tip-sha> --jq '.commit.message'

# 3. Is the tip now some OTHER batch's base? => advanced, not evicted
gh api "/repos/O/R/actions/runs?event=merge_group&per_page=100" --jq '.workflow_runs[].head_branch'
```

`RemovedFromMergeQueueEvent.reason` vocabulary observed: `merged` (normal removal on success — **not** an eviction), `failed_checks`, `checks_timed_out`, `manual`. Only the middle two are eviction classes; `merged` outnumbered them 6-to-2 in a 24h window, so filtering on "a removal exists" over-counts ~4x.

## Timestamp discriminator

The other phantom (#12407) was even cleaner: `RemovedFromMergeQueueEvent` was **empty** (never evicted, ever) and its `enqueuedAt` 08:45:02Z **pre-dated** the blamed run's `run_started_at` 09:51:59Z. A failing job inside an *in-flight* batch run is not an eviction. Always compare `enqueuedAt` vs `run_started_at` before attributing.

## Sibling-batch control (bonus)

Batches launched at the **same `run_started_at` on the same base** are a near-perfect control for a flaky leg: `31168879414` (pr-11915) passed `test-macos-…/test-slang` at the identical 10:08:49Z that `31168878894` failed it. Same base, same hour, same runner class, different outcome ⇒ single-runner flake, no code variable involved.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1786105103694-merge-queue-branch-name-is-pr-n-basesha-not-the-pr.md`_
