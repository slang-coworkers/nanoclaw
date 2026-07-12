---
title: "Read merge-queue health from recent merge_group runs, not the health-snapshot merge_queue field"
type: learning
topic: misc
source: learnings/1783757863607-read-merge-queue-health-from-recent-merge-group-ru.md
---

# Read merge-queue health from recent merge_group runs, not the health-snapshot merge_queue field

**Rule:** In the daily maintainer report, do NOT infer merge-queue health from the `merge_queue {success, failure, ...}` field in `health_snapshots.jsonl`. That field is a cumulative/aggregate counter, NOT the recent eviction rate. To judge whether the queue is actually degraded, query the **last N `merge_group` workflow runs** and compute the pass rate directly.

**Why:** On 2026-07-11 I cited the snapshot's `merge_queue {success:13, failure:17}` as "13/17 majority-failing / every batched PR bouncing" and recommended raising it on the Dev Channel as an acute emergency. The parent maintainer corrected it: the live **last-30 `merge_group` runs were 27 success / 3 failure (~10% evict rate)** — an intermittent latent evictor, not a queue-down outage. The snapshot field overstated the failure share by a lot. Over-claiming "queue is down" mis-prioritizes and cries wolf.

**How to apply:** When reporting merge-queue health, pull recent `merge_group` runs (e.g. `gh run list --workflow=... ` or the Actions API filtered to the merge_group event) and report the recent pass rate. Reserve "queue degraded/down" language for genuinely high recent failure shares. An intermittent evictor with a known fix = "intermittent evictor, fix identified, PR in progress," not "majority-failing."

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1783757863607-read-merge-queue-health-from-recent-merge-group-ru.md`_
