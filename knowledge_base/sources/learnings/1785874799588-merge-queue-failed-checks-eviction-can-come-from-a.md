# Merge-queue failed_checks eviction can come from a COMMIT STATUS, not a check-run — check both surfaces

## What happened

Slang PR #12328 (2026-08-04) was evicted from the merge queue with GraphQL `RemovedFromMergeQueueEvent.reason = "failed_checks"` — yet **every check-run on the merge-group commit that was terminal before the eviction timestamp was `success`**. A check-run-only sweep therefore concludes "no failure caused this", which is wrong.

The actual cause was on the **other** status surface:

```
GET repos/{o}/{r}/commits/{merge_group_sha}/status
  combined_state=failure
  license/cla    success
  SlangPy Tests  failure   18:16:41Z   <- 31s before the 18:17:12Z eviction
```

`SlangPy Tests` is a **cross-repo commit STATUS** (posted by shader-slang/slangpy via `target_url`), not a check-run. `/check-runs` and `/status` are two independent GitHub APIs; a PR can be all-green on one and red on the other.

## Rules

1. **A CI sweep must read BOTH `commits/<sha>/check-runs` AND `commits/<sha>/status`.** Fetching statuses but only analyzing check-runs is a silent coverage hole — I had all 75 status files on disk and still nearly missed this. Analyze what you fetch.
2. **Do not date-order a cause after its effect.** The same merge-group run also had a `cancelled materialx-integration` at 18:44:35Z, which *looks* like a plausible evictor — but it POSTDATES the 18:17:12Z eviction, so it is a consequence (queue teardown), not the cause. Always compare job `completed_at` against the eviction timestamp before attributing.
3. **Get the reason from GitHub, don't infer it.** `RemovedFromMergeQueueEvent` exposes `reason` + `beforeCommit.oid` directly:
   ```
   gh api graphql -f query='{repository(owner:"O",name:"R"){pullRequest(number:N){
     timelineItems(last:10,itemTypes:[REMOVED_FROM_MERGE_QUEUE_EVENT]){nodes{
       ... on RemovedFromMergeQueueEvent{createdAt reason actor{login} beforeCommit{oid}}}}}}}'
   ```
   `reason:"merged"` = the healthy exit; `reason:"failed_checks"` = a real eviction.
4. **A wake/orchestrator payload reporting `evicted: []` can be manufactured absence.** Cross-check independently via `actions/runs?event=merge_group` (look for non-success conclusions) plus the per-PR timeline. Here the payload said `evicted:[]` and one PR was genuinely stranded.

## Classifying the cross-repo status failure

Use a **cross-PR control** rather than judging the failing test in isolation: slang #12281's slangpy run failed the *same file* (`tests/sgl/device/test_profiler.cpp`) at a *different assertion* (line 534, Windows/GPU) and then **passed on retry**, while #12328's hit lines 284–287 on Linux/CPU. Same file, different assertion, different platform, self-healing ⇒ flaky timing test, unrelated to #12328's parser-only change. A signature that moves between platforms/assertions is intermittent; one that reproduces identically is not.
