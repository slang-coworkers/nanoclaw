---
title: "A pass-fail RATIO from one per_page=100 listing describes the WINDOW, not the day — and it fails toward the indicting answer"
type: learning
topic: misc
source: learnings/1785926557981-a-pass-fail-ratio-from-one-per-page-100-listing-de.md
---

# A pass-fail RATIO from one per_page=100 listing describes the WINDOW, not the day — and it fails toward the indicting answer

## The trap

A ratio computed from a recency-ordered GitHub API listing (`actions/runs?per_page=100`, any "last N
runs") is a statement about **the window that listing happened to cover** — and the window's width is
a function of *repo traffic*, so it varies silently between sweeps.

This is the sibling of the better-known windowed **zero**, but strictly more dangerous. A zero at
least looks like an absence you should go probe. A ratio looks like a **measurement**: `2 fail / 0
success` is fluent, quotable, and arrives with a denominator attached — nothing about it announces
that the denominator was truncated.

## The case (shader-slang/slang, 2026-08-05)

Measuring whether self-hosted runner SLANGWIN5 was broadly sick or carrying a job-scoped defect, one
`per_page=100` call returned bounds `09:04Z → 10:12Z` — **~68 minutes**, because the repo had burned
100 workflow runs in an hour. Inside that slice SLANGWIN5 was **2 failure / 0 success**, which reads
as *"the box is wholly sick"* and satisfies a 2-consecutive-failure escalation trigger ⇒ a
reboot/decommission ask to a maintainer.

Paginating 4 pages over the same calendar day recovered **6 passes** (3 Falcor Perf, 2 Falcor, 1
benchmark) against 8 failures ⇒ **job-scoped defect on a healthy host**, whose correct remedy is
"reprovision the broken tool", not "reboot the box".

## Why it's asymmetric

⭐ **The truncation deleted the EXCULPATING rows, not a random sample.** The failures clustered in the
recent slice; the passes sat just outside it. A short window on a subject that currently looks sick is
biased **toward the indicting answer** — and a figure that confirms a suspicion you already hold is
the figure you check least. That combination is a false-positive escalation waiting to happen.

## What to do

- **Print the window bounds beside every ratio:**
  `gh api -X GET '<path>?per_page=100' --jq '[.workflow_runs[].created_at] | "newest=\(max) oldest=\(min) count=\(length)"'`
  If the bounds don't cover the period you're claiming, you don't have a figure yet.
- **`count >= per_page` is the truncation tell** (`>=`, not `==`).
- **State the reach inside the claim**: "0-for-3 *across all `ci.yml` runs ≥00:00Z, attempt-scoped, 2
  rows non-terminal at capture*" — not "0-for-3 today".
- Same sweep, same class, different field: run-level `created_at` is attempt-1's stamp, so "last N
  runs by `created_at`" drops every rerun — key pool/frequency work on the **job's** `started_at`.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1785926557981-a-pass-fail-ratio-from-one-per-page-100-listing-de.md`_
