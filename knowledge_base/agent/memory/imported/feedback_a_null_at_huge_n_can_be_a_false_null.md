---
type: feedback
name: feedback_a_null_at_huge_n_can_be_a_false_null
description: "0/4000 was published as 'did not reproduce'; changing the METHOD (inject delay at the drain() window) gave 21/30 on base, 0/30 fixed. Sample size cannot compensate for a probe that cannot reach the phenomenon — and the huge n is what makes it look already-controlled. Also: one observed failure in 400 runs is NOT '~1/400' — a bare ratio smuggles a frequency claim past a universal-verb scan. Injection proves mechanism and susceptibility, never production rate."
metadata:
  node_type: memory
  type: feedback
  originSessionId: main-2026-08-04
---

# A null at huge n can be a false null: method beats repetitions

Split 2026-10-17 from [[feedback_name_what_your_instrument_cannot_record_before_enumerating]], the family
entry point. Same night and same chain (slangpy profiler #1072) as [[feedback_elimination_is_not_sufficiency]].

## The case

A reproduction attempt returned **0 / 4000** and was published as *"attempted and did not reproduce."* Then
the **method** changed: inject delay at the `drain()` window instead of repeating runs. That gave **21/30
failures on base across a 500× widening (100 µs–50 ms) and 0/30 on the fix.** We also saw **one natural
failure in 400 unmodified Release runs.**

**A null at n=4000 feels like the strongest possible negative, but it was measuring the wrong window.**
Sample size cannot compensate for a probe that cannot reach the phenomenon. Carry the limit with the
result: **injection proves mechanism and susceptibility, never production rate.**

## ⛔ Do not write one failure as "~1/400"

I did, and so did the triager, and I relayed it to an operator (corrected there too). It is a **rate claim
from one observed failure**, and the same build gave 0/4000 in a separate attempt. The honest form: *the
failure occurs on stock `main`, and we have not measured how often.*

**A bare `~N/M` ratio smuggles a frequency claim past a scan for universal verbs.** The triager rescoped
every immune / deterministic / necessary / guarantees verb, and the ratio survived because it contains none
of them. **Watch bare ratios as well as universal verbs.** A ratio inherited from a peer looks like a
measurement even when the peer's own memo says it is not.

## How it extends the nearby rules

- [[feedback_a_discriminator_is_a_claim_about_a_log_run_it]]: a positive control must run against an
  artifact that *contains* the signal. That covers a probe aimed at the wrong artifact. The false null is a
  probe aimed at the **right artifact through a window the phenomenon cannot cross**. That case is harder,
  because the huge n makes it look already controlled.
- Tell *0 failures / 0 executions* apart from *0 failures / 200 executions* (too few trials) **and** from
  *many trials through an unreachable window*.
