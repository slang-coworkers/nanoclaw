---
title: "A threshold that fires on 100% of samples is a constant, not an alarm"
type: learning
topic: misc
source: learnings/1786120926518-a-threshold-that-fires-on-100-of-samples-is-a-cons.md
---

# A threshold that fires on 100% of samples is a constant, not an alarm

## The finding

The shader-slang CI-health runbook documents **"Runner group saturation: busy == total ⇒ critical"**. Measured against 37 consecutive `health_snapshots.jsonl` frames (2026-08-06→08-07), that predicate fired on **37 of 37 frames — 100%**. Per group:

| group | frames | busy==total (total>0) | total==0 |
|---|---|---|---|
| Windows GPU (GCP) | 37 | **35** (94.6%) | 1 |
| Windows Build (GCP) | 35 | 25 (71%) | 10 |
| Linux GPU (GCP) | 20 | 17 (85%) | 2 |
| Linux SM80Plus GPU (GCP) | 33 | 12 | 19 |
| Windows (static) | 37 | 12 | 0 |

## Why

The `*(GCP)` pools are **ephemeral / autoscaled**: runners are registered on demand, so a runner exists almost only while it holds a job. `busy == total` is therefore their *resting state*, and `total == 0` (not slack) is what idle looks like. Observed sequence for one group across 8 frames: `1/1, 2/2, 3/3, 4/4, 4/4, 0/0, 6/6, 0/0` — never once `busy < total`. Only the **static** `Windows` pool (total=3, fixed) ever shows genuine slack, which is exactly why it's the only group where the ratio means anything.

## The discriminating replacement

`queued > 0 AND running == 0` for a group fired on **7 of 37 frames (19%)** — it separates "work waiting with no pool" (cold start / absent) from "pool fully used with an empty queue" (efficiency). Better still, alarm on **queue AGE**, not any ratio: capacity = runners × job duration. A 1-runner pool with 43-min jobs is *arithmetically expected* to show multi-hour waits at 2 jobs/hr arrival, and no ratio expresses that.

## The generalizable rule

**Before trusting any threshold, compute its firing rate over a window that contains known-good samples.** A predicate that fires on every frame — or never — carries zero bits regardless of how sensible it reads in prose. This is the threshold-level analogue of "a constant mistaken for a measurement": there, a field didn't vary across outcomes; here, a *derived predicate* doesn't. Same test kills both: **prove it VARIES.**

Tell that you're being had: you find yourself manually overriding the documented threshold with a hand-written excuse every single time you evaluate it ("busy==total but queued=0, so not really critical"). Three consecutive overrides means the threshold is wrong, not that you're being appropriately careful. The override *is* the data.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1786120926518-a-threshold-that-fires-on-100-of-samples-is-a-cons.md`_
