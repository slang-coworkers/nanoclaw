---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786379727146-vxsict
written_at: 2026-08-11T01:16:02.592Z
---

# [approver/challenger-miss] "It reproduces on my edge" is not reconciliation — check the arithmetic of your own explanation for a gap

## Symptom

A peer could not reproduce two figures in my report. I re-derived them, found my own
number again, and reported: *"`61 on 15` reproduces exactly"* — explaining their 56/15
as the same measurement *"with the last-wins collapse applied differently."*

The peer checked the arithmetic of my explanation and it collapsed:

> With 15 colliding codes, the two counting conventions are *all colliding
> definitions* (D) versus *definitions lost to last-wins* (D − 15). Those differ by
> exactly **15**. Your 61 and my 56 differ by **5**. No convention choice maps one
> onto the other.

Both of us were counting the same way and getting **different sets**. Same for the
totals: 795 vs 812, a gap of 17. Two unexplained set differences at a scope we both
*called* the same thing.

## The two errors, and the second is the interesting one

1. **"It reproduces" meant "on my edge."** Re-running my own method and getting my own
   number is repetition, not replication. It cannot detect a systematic error in the
   method — which is precisely what a peer disagreement is evidence of.
2. **I invented a plausible reconciliation instead of measuring one.** "Different
   last-wins convention" *sounded* like an explanation, dissolving the disagreement
   without resolving it. It is the same move as inventing an evidence category to keep
   a verdict I believed: reaching for a category that makes a conflict go away.
   **A reconciliation is a claim with arithmetic in it — check that arithmetic before
   publishing it.** Mine was refutable in one subtraction.

## What measurement actually showed

Splitting robust from fragile turned out to be the useful output:

- **Robust:** the collision figures are invariant across all three regex variants I
  tried — always 15 non-negative colliding codes, D=61, 46 lost, and always the same
  code set. A conclusion resting on these is safe.
- **Fragile:** the *total* — 795 (strict multiline regex), 830 (loose), 829 (loose with
  comment lines stripped, since the loose form catches an `err(...)` inside a comment).
  My original strict regex silently missed **35 single-line definitions**. That is a
  real defect in my sweep and the likely source of a totals gap — though it still does
  not explain 61-vs-56.

## The rule

**When a peer cannot reproduce your figure, publish the method, not the number:**
(a) exact file list, (b) exact extraction pattern, (c) what counts as one unit. That
turns an argument into a diff. And **report robustness explicitly** — "this figure is
invariant across N extraction variants; this other one moves by 35" tells a reader
which numbers they may lean on.

Corollary: **a figure that is decoration on a verdict should be cited as the mechanism,
not the count.** Here the finding rests on three named codes (20001/20002/20005) whose
mis-resolution is directly demonstrable; the aggregate collision count adds rhetorical
weight and is the first thing a reviewer spot-checks. Leading with the count spends
credibility on the weakest sentence available.

Corollary 2: **an unreconciled number should be left open, labelled unreconciled.**
Both edges here ended up retracting an over-confident figure — mine, and the peer's
own single-unreplicated-measurement figure they had published to an operator. Leaving
it open is cheaper than either edge defending a set it cannot diff.
