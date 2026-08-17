---
title: "Rank a flake's LIVE cost from an independent live cross-section, not your own rerun ledger"
type: learning
topic: ci-tooling
source: learnings/1786162703275-rank-a-flake-s-live-cost-from-an-independent-live-.md
---

# Rank a flake's LIVE cost from an independent live cross-section, not your own rerun ledger

## The trap

"Signature X got fixed" is the flattering claim in a CI-babysitter report — it credits the
maintainers (and implicitly your escalation). So it gets audited least. Mine nearly shipped
uncontrolled.

Time-splitting my own `rerun-log.jsonl` (2026-08-08 sweep) showed
`test-compile-regression`: **10 reruns in the 48–168h half, 0 in the last 48h**. Reads as a fix.

But the activity control was **broken**: declines were 119 in the recent half vs **0** in the older
half — not because nothing was declined then, but because the free-text `result` vocabulary differed
across days (`result` is an OPEN vocabulary — 47 distinct values in 1758 rows: `left` 993,
`declined` 215, `reran` 46, plus `moot`/`method`/`note`/`correction`/…). With no valid activity
proxy, "0 reruns lately" is indistinguishable from "I classified differently lately."

## The fix — an INDEPENDENT basis

Bucket the signature across **live current jobs** from this sweep's own enumeration, never from your
ledger prose:

```
compile-regression   success=46  failure=0   => 0.0% of 46 terminal
falcor               success=93  failure=1   => 1.1% of 94  (the 1 = an expired-log stale row)
materialx            success=72  failure=0   => 0.0% of 72
```

That is a real fix signal: 0-of-46 on *current heads* across 76 non-draft PRs. The ledger could only
ever have told me about my own behaviour.

## Rules

- **Rank LIVE cost by DECLINES, not reruns-fired.** `reruns` is past tense — it counts what you
  already remediated. Declines are the unfixed cost still hitting humans (7d: POLICY label/format
  49, `check-ci` aggregator 42, falcor 16, GPU test-slang 12, materialx 10).
- **`result=="reran"` ONLY** is a real rerun. `action:"rerun"` means *considered* — most rows are
  declines. `outcome_success` is a follow-up row, not a second rerun.
- **ENUMERATE distinct field values before tallying** an open-vocabulary field.
- **A `jq`/`json.loads` stream ABORTS on one malformed line** → false 0. Count bad lines explicitly
  and print the count; my ledger had exactly 1 of 1759 (a `method` note row, so tallies unaffected —
  but I only knew that because I printed it).

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786162703275-rank-a-flake-s-live-cost-from-an-independent-live-.md`_
