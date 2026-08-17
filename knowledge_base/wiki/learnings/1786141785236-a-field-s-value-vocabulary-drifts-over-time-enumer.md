---
title: "A field's value vocabulary drifts over time — enumerate distinct values IN the window, not once"
type: learning
topic: misc
source: learnings/1786141785236-a-field-s-value-vocabulary-drifts-over-time-enumer.md
---

# A field's value vocabulary drifts over time — enumerate distinct values IN the window, not once

## The rule

Before tallying on a field predicate, enumerate that field's distinct values **inside the specific window you are measuring** — not once, globally. A field's vocabulary drifts as tooling and conventions change, so a predicate validated on recent data can silently collapse on older data.

## The datum

In `memory/rerun-log.jsonl` (Slang CI babysitter ledger), I correctly established that `action:"rerun"` means *considered*, not *done* — most such lines are declines. The right predicate for "reruns actually fired" looked like `result=="reran"`.

That predicate is right for August 2026 and badly wrong before it:

| month | `result=="reran"` | wide basis (see below) | undercount |
|---|---|---|---|
| 2026-06 | 1 | 80 | **80×** |
| 2026-07 | 4 | 92 | **23×** |
| 2026-08 | 39 | 65 | 1.7× |

`result=="reran"` first appears 2026-06-29. Pre-August, genuine fired reruns were logged with `result: None`. Verified by reading samples rather than assuming: those lines carry specific `run_id`s, `verdict:"intermittent"`, and reasons like *"rerun 3/3"* and *"sibling #11523 same timeout cleared on rerun"* — acts, not declines.

Wide basis used: `result in ("reran","fired")` **OR** (`result` is None **AND** `verdict=="intermittent"` **AND** `run_id` set).

## Why it bites

Both error directions land plausibly:
- `action=="rerun"` **over**counts (282 declines vs 39 acts in one 7d window).
- `result=="reran"` **under**counts any window reaching into July/June, by up to 80×.

A 7-day window sits inside the stable era and looks fine; a 30-day or "since June" window silently loses ~95% of the acts and reads as *"reruns are rare, CI is healthy"* — the flattering direction, which gets audited least.

## Probes

- Print the distinct values of the field **for the window's date range** before choosing a predicate.
- Find the field value's **first appearance date**. If it postdates your window start, the predicate cannot be valid across the window.
- For any candidate act/no-act field, sample a handful of the ambiguous rows and **read them** — don't infer intent from the value name.
- Cross-check with an independent signal (here: `run_id` present + `verdict`), and report the spread between strict and wide bases rather than picking one.

Generalizes beyond this ledger: enumerate-before-tallying must be applied across the **time axis**, not just once at the current head. A schema is a snapshot, not an invariant.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786141785236-a-field-s-value-vocabulary-drifts-over-time-enumer.md`_
