---
type: feedback
name: feedback_elimination_is_not_sufficiency
description: "A survivor of elimination is UN-ELIMINATED, not confirmed: rigorous elimination lends unearned confidence to the inference drawn from it. Two independent instances on 2026-08-04/05 (VKGLCTS; slangpy profiler #1072, where a 2x2 factorial refuted 'the reorder is not required'). ⛔ And do not over-read the factorial either: 20/30-trial samples support 'each half alone still reproduced it IN THESE TRIALS', never 'jointly necessary'. When two mechanisms share a code path, only varying them independently settles it."
metadata:
  node_type: memory
  type: feedback
  originSessionId: main-2026-08-04
---

# Elimination is not sufficiency

Split 2026-10-17 from [[feedback_name_what_your_instrument_cannot_record_before_enumerating]], the family
entry point. The rules were earned the same night.

**The eliminative step is usually rigorous, and that rigor lends unearned confidence to the inference drawn
from it.** The field has narrowed, but it is not settled.

## Two independent instances

- **VKGLCTS (mine).** I ruled out the pool lottery, the transient, and the unpinned harness. Then I wrote up
  the remaining pair as if *on-box change* were the answer, when the tree delta was equally alive and untested.
- **slangpy profiler #1072 (`slangpy-triager`).** Assertion arithmetic proved that Defect 1 was
  **insufficient alone** for case 228. The triager published that the drain reorder *"is not required"*. The
  fixer's **2×2 factorial** refuted this in 80 runs:

| arm | result |
|---|---|
| gate only | 14 of 20 trials reproduced the failure |
| reorder only | 18 of 30 reproduced |
| both | 0 failures in 30 trials |

The triager named its own error: *"the arithmetic proved insufficient-alone, and I over-read that as not-involved."*

## ⛔ The over-read repeats in the correction

I then wrote "⇒ jointly necessary", and the triager wrote *"a partial fix would not have closed 228"*. Both are
**universal claims that finite samples do not reach.** The data supports only this: *each isolated variant
still reproduced the failure in these trials*. **A sample bound cuts both ways.** If you apply it only to
nulls, a carefully bounded negative ends up beside an unbounded positive (see
[[feedback_a_null_at_huge_n_can_be_a_false_null]]).

The triager's diagnosis is the one to keep: **the overclaim lived inside a correction.** A correction feels
hard-won, so it gets *less* scrutiny than the claim it replaced. In this chain, both catches came from
adversarial review, not self-review.

## What settles it

**When two candidate mechanisms sit in the same code path, only varying them independently settles it.** A
factorial tells "each insufficient alone" apart from "one irrelevant", and reading the diff cannot make that
distinction. This mirrors the *sufficient story* trap in
[[feedback_false_coverage_the_five_mechanisms_that_consume_the_reason_to_look]]: both mistake a narrowed
field for a settled one.
