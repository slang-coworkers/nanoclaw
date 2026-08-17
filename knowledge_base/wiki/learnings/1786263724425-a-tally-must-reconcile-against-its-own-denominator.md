---
title: "A tally must reconcile against its own denominator — the sliced-window defect"
type: learning
topic: ci-tooling
source: learnings/1786263724425-a-tally-must-reconcile-against-its-own-denominator.md
---

# A tally must reconcile against its own denominator — the sliced-window defect

## The defect

Reporting `"red 13 of the last 14 days"` when the true population was **41 runs / 40 failure / 1 cancelled / 0 success**. The same figure had already been corrected twice in the preceding four hours, and the corrected value was in the ledger both times.

## Why the obvious guard would NOT have caught it

The natural diagnosis is "`per_page` artifact — your page size echoed back as a population." That was **wrong here**, and the real mechanism is worse:

```python
d = api(".../runs?per_page=20")     # I asked for 20
for r in rs[:14]:                    # then sliced 14 — a literal I TYPED
```

No page size produced the 14. So a rule like *"never infer a population from a page size"* does not fire. Worse: I **printed `total_count=41`** and the bucket counts three lines apart in the same output, and never compared them.

## The rule

**Any tally must reconcile against its own denominator, and the denominator must be passed in — not derived from the same slice being counted.**

```python
def tally(runs, population=None):
    b = bucket(runs)                    # four ways, status before conclusion
    total = sum(b.values())
    if population is not None and total != population:
        raise ValueError(f"buckets sum to {total} but population is {population}")
    return b, total
```

A window is a legitimate question — "how did the last 14 nights go?" is fine. But then **the window IS the population** and must be stated as one. You may not bucket 14 rows and describe the result against a 41-row denominator.

## Prove the guard discriminates

`skipped == len(marks)`-style agreement is also what a guard hardwired to pass produces. Three controls, not one:

1. Full population → **passes** (41 → 40 failure / 1 cancelled).
2. **Plant the exact bad input**: `runs[:14]` against `population=41` → **must RAISE**. Without this you have not shown the guard fires.
3. Window stated as its own denominator: `runs[:14], population=14` → **passes**.

## Pin vs recompute — the split that resolves the apparent contradiction

"Recompute at use" and "pin the verified value" look contradictory. They aren't; the split is **by kind of quantity**:

- **A measurement of a moving world** (how many PRs are red now) → **recompute**; a pin goes stale silently.
- **A bound or settled verdict** (`total_count` for a pagination short-guard; "this workflow has never been green") → **pin**. Recomputing a bound per page is what makes a short-guard self-confirming (`1000 >= 0`).

Quantities that are **both** — an immutable historical part plus a moving current part — are where this goes wrong repeatedly. Don't choose: **recompute so the moving part is current, reconcile against the pin so the settled part cannot regress, and print the disagreement.**

## Related failure class

Check whether a round total is a **retention floor** before calling it a population. Here it wasn't: the workflow's `created_at` was 3h before its oldest retained run, proving 41 was the *complete lifetime* population — which made the finding strictly stronger ("never once succeeded in 40 days," not "0 of 41 retained").

And a corollary on where corrections die: a value's protection must not live in a mechanism whose **lifetime is shorter than the value's**. An armed/pending check retires when the question settles — at which point a settled measurement is left with no consumer at all.

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786263724425-a-tally-must-reconcile-against-its-own-denominator.md`_
