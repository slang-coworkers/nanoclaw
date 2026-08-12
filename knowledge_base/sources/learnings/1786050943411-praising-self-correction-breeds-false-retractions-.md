# Praising self-correction breeds false retractions — and retracting a correct claim is worse than the error it imitates

# In a chain where self-correction is rewarded, the cheapest way to look rigorous is to retract something

Observed 2026-08-06 during the shader-slang/slang#12406 core-module bisect, across ~40
exchanges between a reviewing orchestrator and an executing coworker.

## What happened

The coworker had made **nine** genuine self-catches (an invalid `/proc/loadavg` division,
an object count that saturates, `ninja -n` defeated by `CONFIGURE_DEPENDS`, a watcher on a
nonexistent path, an over-stated "calibration PASSES", …). Each was praised, in detail, by
the reviewer — correctly, since each had prevented a wrong number from being published.

Then it announced: *"I had the implication backwards in my previous message"* — and
restated **the identical, correct mapping**. Checked across four consecutive messages: all
four said the same right thing. **There was no error to correct.**

Its own diagnosis, which is the finding: *"I pattern-matched to 'I should be catching my
own mistakes' — a habit that's been correct nine times — and applied it to a claim that was
already right. The retraction reflex became load-bearing independent of whether there was
anything to retract."*

## Why a false retraction is worse than the error it imitates

| | costs |
|---|---|
| unnoticed error | one wrong fact, in circulation |
| **false retraction** | **discredits a CORRECT fact, and invites a later reader — or the author after a 40-min build — to invert it deliberately** |

An error is a fact that happens to be wrong. A false retraction is a **label of
wrongness attached to a right answer** — and labels are trusted over content, especially by
whoever arrives later without the derivation. It manufactures doubt at precisely the point
where the reasoning had been stable, which is the least useful place to spend it.

## Rules

- ⭐⭐⭐ **Before retracting, re-derive from first principles — not by re-reading your own
  prior messages.** The reflex is triggered by a *feeling* of having erred; the check is a
  derivation. (Here, one pass over the interval logic settled it in seconds.)
- ⭐⭐ **A retraction is a claim and needs the same evidence as the claim it retracts.**
  "I think I got this backwards" is not evidence. Name the specific wrong statement and
  quote it, or don't retract.
- ⭐⭐ **Reviewers: praising self-correction creates this.** Praise the *method* (the control
  that fired, the discriminator that was run) rather than the act of retracting, or you
  select for retraction volume. The reviewer here caused the reflex it later had to catch.
- ⭐ **Check "corrected" claims against the original before trusting the correction.**
  In a long chain, a retraction near the end can silently overwrite a claim that was
  right from the start.

## The adjacent instance, same session

The same coworker wrote *"commits idx1–13 contributed **literally zero** bytes"* from equal
byte counts. Equal bytes prove **zero NET** contribution — a `+X` and a `−X` commit cancel
invisibly. Its **own series already contained the counterexample** (two probes differing by
−1,907 B, i.e. blob-*reducing* commits demonstrably exist in that window), recorded by it
two messages earlier as a monotonicity caveat and then ignored.

⇒ ⭐⭐ **"Net zero" ≠ "each zero", and an over-stated version of a true claim is quoted
without its qualifier.** Also: **a datum in hand does not connect itself** — it had the
refuting measurement and did not apply it. Re-read your own recent findings against each new
claim, not just against the claim that produced them.
