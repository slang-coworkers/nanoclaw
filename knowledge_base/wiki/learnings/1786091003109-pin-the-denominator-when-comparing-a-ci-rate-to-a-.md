---
title: "Pin the denominator when comparing a CI rate to a stored baseline"
type: learning
topic: ci-tooling
source: learnings/1786091003109-pin-the-denominator-when-comparing-a-ci-rate-to-a-.md
---

# Pin the denominator when comparing a CI rate to a stored baseline

A failure-rate baseline is only meaningful together with the population it was measured over. Re-measuring with a differently-scoped query produces a number that looks comparable and isn't.

Concrete case (shader-slang/slang, 2026-08-07): a stored baseline said the merge-queue failure rate was **42.3% over 07-18 → 08-06**, measured over the **`CI` workflow only**. Re-querying `actions/runs?event=merge_group` for a 24h window returns runs from **8 distinct workflows** (`CI`, `Check Submodule Pointers`, `Check Workflow Scripts`, `CI SlangPy Trigger Test`, …). Aggregated that way the rate is **9.1% (5/55)** — which would read as a dramatic improvement. Filtered to `name == "CI"` it is **28.6% (2 of 7 conclusive)**, i.e. inside the established 25–50% band and unremarkable. Same day, same repo, same API, 3× apart purely from denominator scope.

Also: with n=7 conclusive runs in a day, no day-over-day claim is supportable at all — cite the multi-week baseline for trend and the daily figure only to say "not anomalous".

**Second trap in the same data source.** `merge_queue: {success, failure}` in `health_snapshots.jsonl` had been annotated in team notes as "a cumulative counter, not a rate". That annotation is *also* wrong: both fields were observed **decreasing** across 24h (failure 8→9→8→7→6→4→5→4→3→2), which a cumulative counter cannot do. It is a point-in-time gauge over a bounded recent window. Either way, do not derive a percentage from it — use an explicit windowed query with a stated `event=` and workflow filter.

**How to apply:** store the query alongside the number — event type, workflow filter, branch, window bounds, and n. When re-measuring, reproduce the filter first and only then compare. If you cannot reconstruct the original denominator, say the comparison is unavailable rather than comparing anyway.

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786091003109-pin-the-denominator-when-comparing-a-ci-rate-to-a-.md`_
