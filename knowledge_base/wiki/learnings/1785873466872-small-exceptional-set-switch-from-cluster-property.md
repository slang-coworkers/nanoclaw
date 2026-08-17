---
title: "small exceptional set: switch from cluster-property to per-file predicate, then check the predicate measures the mechanism"
type: learning
topic: misc
source: learnings/1785873466872-small-exceptional-set-switch-from-cluster-property.md
---

# small exceptional set: switch from cluster-property to per-file predicate, then check the predicate measures the mechanism

# When a small exceptional set satisfies every hypothesis, stop asking what the set shares

Origin: parent + me, 2026-08-04, chasing why 11 of 2442 shared-learning filenames exceed the ~50-char
slug cap. Three mechanisms were proposed and refuted in twenty minutes, all correct as *correlates*:

| hypothesis | enrichment | why it failed |
|---|---|---|
| hand-rounded timestamps | 5/11 vs 9/2442 corpus-wide = **120×** | 6 of 11 have ordinary epoch-ms |
| hand-merged producer (`CONSOLIDATED-*`) | 6/11 vs 0.8% = **50×** | 5 of 11 aren't `CONSOLIDATED`; 8 of 14 `CONSOLIDATED` ARE capped |
| capability window (all 11 in one time range) | 82 before / 1719 after = **0 exceptions either side** | inside the window, **598/598** files were capped — the cap was fully active |

**A small exceptional set is unusual in several correlated ways at once, so it satisfies many
hypotheses and discriminates between none.** Every one of those tests asked *what do these 11 have in
common* — and with n=11 and ≥3 correlated attributes, that question is unanswerable from the data.

## The axis change

Ask instead: **what does each member individually fail to satisfy?** A per-file predicate, with a
two-sided control, is not bounded by the size of the exceptional set.

Here the winning predicate is **`slug length == 50`** — a direct fingerprint of the cap having been
applied by `append_learning`, which slugifies the title at *filename creation*:

```
every file with slug length exactly 50   → went through the slugifier
9 of the 11 over-cap files               → never did (written to disk with hand-chosen names)
```

That single property explains all three correlates without being a fourth: the 11 cluster in a time
window because that's when a human was hand-curating; they skew `CONSOLIDATED` because hand-merging
was the curation; some timestamps are round because a human typed them. **One cause, three symptoms —
which is exactly why three cluster tests each half-worked.**

## Per-file was necessary, NOT sufficient — check what your predicate measures

My first per-file predicate was **"does the slug derive from the file's own H1?"** It gave a clean-looking 2×2:

```
                over>50    <=50
  derived            2      2362
  hand-named         9        51      P(over|hand)=15.0%  P(over|derived)=0.08%  → 177×
```

Then I opened the 51-file cell: **42 of them have slug length exactly 50** — i.e. `append_learning`
*did* produce them, and their H1 was **rewritten after filing**. (Common here: a keyword-loaded first
line for the index, a readable heading below.) So the predicate conflated *a human named this file*
with *the heading was edited later*, and was **70% contaminated in the cell cited as its positive
control**.

⭐ **The tell: a two-sided control feels most conclusive exactly when the contamination sits inside the
confirming cell.** The 2×2 looked right from every angle except opening the files. A 30-file sample
hid the 42; a full-corpus run surfaced the cell but its *size* read as corroboration rather than as
something to inspect.

So the complete rule is: **ask what each member individually fails to satisfy — then verify the
predicate measures the mechanism, not a habit correlated with it.** `slug length == 50` measures the
cap. `slug matches H1` measures editorial style.

## Two smaller instruments from the same run

- **Compute ratios from raw counts, round only at the end.** `15.0 / 0.08 = 187×` but
  `(9/60)/(2/2364) = 177×` — 0.0846 rounded to 0.08 understates the denominator by 5.5%, and division
  compounds it. Same signature as reading the wrong field: the right value was one step back.
- **Get a base rate before accepting an enrichment.** "5 of 11 have 6+ zero-runs" means nothing until
  you know it's 9 of 2442 corpus-wide (0.37%). Also: count **interior** zero-runs, not trailing —
  `…690000002` has zero trailing zeros and is obviously hand-made.

## Why it was worth twenty minutes

Every claim was testable in one command, and none of it was in the PRs — they were parked on human
decisions, so there was no clock. **That ratio is a property of the situation, not of the people**, and
it doesn't survive contact with a build queue. Which is the argument for banking discriminators when
they're cheap: they apply later under load, but they can't be derived there.

Companion: [[1785872011901-detector-self-check-ls-1t-returns-the-generated-in]] (check the detector
before the world) — this is the same defect one layer out, on a *predicate* rather than a detector.
Third instance that day of a check that passed while pointing at the wrong thing: an inert
`CHECK-NOT`, an unconditional `grep INDEX.md INDEX.md`, and a populated control cell whose contents
contradict its label. **All three byte-identical to a working check from outside.**

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785873466872-small-exceptional-set-switch-from-cluster-property.md`_
