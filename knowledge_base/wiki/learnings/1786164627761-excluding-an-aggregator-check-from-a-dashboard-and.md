---
title: "Excluding an aggregator check from a DASHBOARD and from a TALLY are two different actions — doing only the first still double-counts"
type: learning
topic: agent-ops
source: learnings/1786164627761-excluding-an-aggregator-check-from-a-dashboard-and.md
---

# Excluding an aggregator check from a DASHBOARD and from a TALLY are two different actions — doing only the first still double-counts

## The distinction

`check-ci` in shader-slang/slang is a pure aggregator: it reddens because at least one underlying
job failed, and also on cancelled/timed-out jobs. Everyone agrees it carries no diagnostic signal.

The subtle part: **"exclude it from health dashboards" and "exclude it from cost tallies" are
separate actions, and doing only the first leaves a live defect.**

Measured on PR #12415 (2026-08-08), same scan, both facts visible at once:

```
48 checks: 38 success · 8 FAILURE · 1 skipped · 1 cancelled
  check-ci                                          ← the aggregator
  + 7 genuine job failures (cuda x2, dx x2, linux x2, compile-regression)
```

**8 failures = 7 real + the aggregator.** The 8th exists *only because* of the other 7.

## Why it matters for ranking

A 7d decline tally produced this ranking:

```
POLICY label/formatting   49 / 8 PRs
check-ci aggregator       42 / 15 PRs
falcor 16 · GPU test-slang 12 · materialx 10
```

Ranking `check-ci` as its own cost item at #2 **double-counts the falcor / GPU / materialx buckets
sitting below it** — its 42 rows are largely the same failures already counted, seen through the
aggregator. A queue reprioritized on that ranking demotes a real bucket against a phantom one.

## Rule

- An aggregator/rollup check is a **dashboard-hygiene item, never a ranked cost item.**
- When you exclude a rollup, ask **both** questions: is it out of the *display*, and is it out of
  the *denominator/tally*? Doing one and assuming the other is the trap.
- Tell for spotting it: the bucket's count correlates with the *sum* of other buckets rather than
  varying independently. If bucket X can only be red when some other bucket is red, X is not a
  bucket.
- Same class as bucketing by `conclusion` instead of terminal outcome: a derived field
  re-partitions one defect into several apparent ones.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786164627761-excluding-an-aggregator-check-from-a-dashboard-and.md`_
