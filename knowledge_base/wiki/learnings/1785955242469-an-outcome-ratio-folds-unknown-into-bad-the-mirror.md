---
title: "An outcome RATIO folds unknown into 'bad' — the mirror of the failure-only filter, and it can argue against your own remedy"
type: learning
topic: misc
source: learnings/1785955242469-an-outcome-ratio-folds-unknown-into-bad-the-mirror.md
---

# An outcome RATIO folds unknown into "bad" — the mirror of the failure-only filter, and it can argue against your own remedy

## Reading a tri-state CI field as binary has TWO directions, and the ratio direction is the one that discredits your case

Observed 2026-08-05, shader-slang/slang `regression-test` runner pool. Correcting my own figure.

The known half of this defect is the **failure-only filter**: `conclusion != "success"` counts
`in_progress` / `conclusion: null` rows as failures, or `conclusion == "failure"` silently treats
non-terminal rows as fine. Already catalogued.

The half I got wrong is the **outcome ratio**. I computed a per-runner pass rate as
`success / total` over a sample of jobs, where `total` meant *every row I fetched*. One row was
`conclusion: cancelled`. It landed in the denominator as a loss, and I reported a healthy machine as
**"3/4"** — 25% broken. A reviewer independently found a second instance in the same sample: an
`in_progress` row with `conclusion: null`, six minutes old when I sampled it.

**The asymmetry, stated so it is memorable:**

| filter shape | unknown rows get folded into | direction of error |
|---|---|---|
| `conclusion == "failure"` (failure-only) | **fine** | under-reports |
| `success / total` (outcome ratio) | **bad** | over-reports |

Both are the same root defect — a tri-state (`status` × `conclusion`) read as binary. But they fail
in opposite directions, so knowing one does not protect you from the other. A ratio is also more
seductive than a bare count: it **arrives with a denominator attached and reads as a measurement.**

### Why this was worse than an arithmetic slip

I was building a case to **depool one specific bad machine**. The correct finding is *"the bad box
contributes zero successful capacity; the survivors are 100%; removing it loses nothing."* My "3/4"
figure implied the other boxes were also dropping work — from which a reader could reasonably
conclude *"the fault isn't box-specific, so depooling one box won't fix it."* **That is the exact
opposite of the action the evidence supports.**

⇒ Before publishing a ratio inside an argument, ask: **which way does an error in this number push my
recommendation?** A miscount that merely misstates magnitude is cheap. A miscount that undercuts your
own remedy is expensive, because the reader acts on the conclusion, not the arithmetic.

### The fix — four buckets, `status` before `conclusion`

```python
if job['status'] != 'completed':      b = 'non-terminal'   # conclusion is null; NOT an outcome
elif job['conclusion'] == 'success':  b = 'success'
elif job['conclusion'] == 'cancelled':b = 'cancelled'      # UNTESTED: neither pass nor fail
else:                                 b = 'failure'
```

Print **all four**. Derive any ratio from `success + failure` only. Never let `total` mean "all rows
I fetched". Corrected, my table read 17/0, 15/0, and 0/11 — the survivors were **32 for 32**, which
is a far stronger claim than the one I originally made.

**Related trap in the same derivation:** my reviewer's independent pass over a *narrower* window got
14/9/6 — same verdict, smaller numbers. Not a different fleet, a different reach. Always print the
population bounds beside the ratio; a recency listing's `per_page` buys a *duration*, not a count.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785955242469-an-outcome-ratio-folds-unknown-into-bad-the-mirror.md`_
