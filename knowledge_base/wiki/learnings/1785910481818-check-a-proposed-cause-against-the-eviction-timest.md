---
title: "Check a proposed cause against the eviction TIMESTAMP before accepting it — teardown artifacts postdate the eviction"
type: learning
topic: misc
source: learnings/1785910481818-check-a-proposed-cause-against-the-eviction-timest.md
---

# Check a proposed cause against the eviction TIMESTAMP before accepting it — teardown artifacts postdate the eviction

## The rule

A merge-group run's failing/cancelled jobs are **not all candidate eviction causes**. Once GitHub
evicts a PR (`reason=failed_checks`), it tears the merge-group run down — so sibling jobs get
`cancelled` *after* the fact. Any job whose failure/cancel timestamp **postdates** the
`RemovedFromMergeQueueEvent.createdAt` is a **consequence, not a cause**.

## Observed 2026-08-05 (shader-slang/slang #12328)

A subagent examined merge-group run 30936533243, found `check-ci` naming
`test-materialx-windows-release: cancelled` as the sole non-success dependency, and concluded
materialx had caused the eviction — explicitly proposing this as a *correction* to a stored note
saying materialx is "NOT an eviction cause." The reasoning was internally coherent (`check-ci` is
`if: always()` and gates on `!= "success"`, so a cancel does fail it).

The timeline refutes it:

```
18:16:41Z  'SlangPy Tests' COMMIT STATUS -> failure     <-- 31s before eviction = the cause
18:17:12Z  RemovedFromMergeQueueEvent reason=failed_checks
18:29:16Z  materialx job STARTS                          <-- 12 min AFTER the eviction
18:44:35Z  materialx job cancelled (15m19s vs timeout-minutes: 15)
```

materialx had not even started when the PR was evicted. The stored note was right.

## How to apply

1. Get the eviction instant first:
   `gh api graphql` → `pullRequest.timelineItems(itemTypes:[REMOVED_FROM_MERGE_QUEUE_EVENT])`
   → `createdAt` + `reason` + `beforeCommit.oid`.
2. Only jobs/statuses **completing before** that instant are candidate causes.
3. Check **both** surfaces on `beforeCommit.oid` — check-runs *and* commit statuses are independent;
   here the cause existed only on the status surface, invisible to `check-runs`.
4. `check-ci` is an aggregator: it reports whichever dependency was non-success **at the time it
   ran**, which is often after the eviction. It names symptoms, not causes.

## Meta-lesson

A subagent's confident "your memory is wrong" is a claim about *their* analysis, not the world —
reproduce its load-bearing step before overwriting a stored fact. Here the cheap discriminator (one
timestamp comparison) was never run by the proposer. Note the asymmetry: accepting the correction
would have corrupted a correct memory *and* mis-attributed a maintainer-facing cause.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1785910481818-check-a-proposed-cause-against-the-eviction-timest.md`_
