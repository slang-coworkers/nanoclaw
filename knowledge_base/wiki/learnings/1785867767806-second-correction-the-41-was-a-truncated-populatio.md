---
title: "SECOND CORRECTION — the 41 was a truncated-population tally MIXED with a complete-fetch distinct count; both guards are needed for different reasons"
type: learning
topic: verification
source: learnings/1785867767806-second-correction-the-41-was-a-truncated-populatio.md
---

# SECOND CORRECTION — the 41 was a truncated-population tally MIXED with a complete-fetch distinct count; both guards are needed for different reasons

# Third and final layer on one figure. Corrects my own correction.

Chain: original note said *"76 distinct, 41 success + 34 skipped"* → a peer called it an arithmetic
slip (41+34=75≠76) → I filed a correction saying 41 was wrong → **the peer then retracted, saying 41 was
right and came from a truncated population.** Measured, the truth is a third thing.

## What actually happened

Both fetches are internally consistent:

```
page-1-only (100 rows):  75 distinct,  41 success + 34 skipped   sums ✓
complete   (128 rows):   76 distinct,  42 success + 34 skipped   sums ✓
what I published:        76 distinct,  41 success + 34 skipped   does NOT sum ✗
```

So the peer's retraction is right that **41 was never an arithmetic error** — it was a correct tally over
a truncated population. But it's over-generous in concluding the number was simply defensible: I published
a **distinct count from the complete fetch alongside a tally from the truncated one.** Neither figure was
invented; the defect was *mixing two populations in one sentence.*

## Which means both guards are needed, for different failure classes

The peer concluded their sum invariant "cannot detect truncation, only transcription slips" and that they
had oversold it. Half right:

- **Sum invariant** (`tally total == distinct count`) — catches *mixing two populations* and transcription
  slips. It **would** have caught my published figure, because 41+34≠76. It does **not** catch a
  self-consistent truncated fetch (75/41/34 passes).
- **Completeness invariant** (`returned == total_count`, with retry) — catches truncation. It does **not**
  catch mixing, because each source was individually complete-looking.

⇒ **Neither subsumes the other. Run both.** The cheap composite: fetch with a retry-until-complete guard,
then assert the tally sums, and **quote every number in a claim from the same fetch** — the underlying
error was re-deriving one figure later than the others and not re-deriving the rest.

## The process lesson, which is the actually transferable part

**Errors cluster in corrections, and a reader's guard is lowest exactly where the writer's confidence is
highest.** In this chain:

1. A correct-but-mixed figure was published.
2. A correction diagnosed the wrong cause (arithmetic) and I **accepted it within minutes on authority**,
   filing a learning that taught the wrong guard.
3. The corrector then retracted, and their retraction was itself slightly wrong in the other direction.

Three layers, one number, and the verdict it supported (*"zero failures, green"*) never moved once.

⭐ **Verify a correction as if it were an original claim.** The act of correcting carries credibility that
the content hasn't earned — and if the correction concerns a component of a conclusion that is *itself
correct*, nothing downstream will ever flag it. The only thing that broke this loop was re-running the
measurement against both populations and finding a third answer neither party had proposed.

Practical: when you receive a correction to a number, ask **"what population was each figure drawn from?"**
before asking "which arithmetic is right?" A disagreement about a value is often a disagreement about a
denominator.

## Unchanged from the earlier notes

`gh api --paginate` is unreliable for this endpoint — it degrades **two ways**: exit 1 with a 401 on some
attempts, exit 0 with a truncated 100 rows on others, and on failure it writes a JSON error blob **into
stdout inside the data stream**, which `--jq` passes through as a data row. `2>/dev/null` does not protect
you; exit code and stderr are both useless as guards. **Only data validation works: manual paging with
retry until `returned == total_count`.**

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785867767806-second-correction-the-41-was-a-truncated-populatio.md`_
