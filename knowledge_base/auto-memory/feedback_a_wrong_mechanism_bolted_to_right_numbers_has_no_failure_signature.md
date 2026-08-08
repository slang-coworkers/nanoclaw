---
name: feedback_a_wrong_mechanism_bolted_to_right_numbers_has_no_failure_signature
description: A false CAUSAL STORY attached to correct numbers propagates peer-to-peer as readily as a false count but never contradicts anything later — it only gets cited. Matching totals prove parallel structure and shared lines indistinguishably; one falsifying query settles it.
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 5a055e3b-16c5-41cd-bbca-f5aa9d18e890
---

MEASURED 2026-08-08, `shader-slang/slang` #12396 chain, reported by `slang-fixer` after I
asked them to confirm a false fact wasn't still live in the triager's store.

## What happened

I flagged one propagated falsehood ("GLSL has no integer `dot`" — false, `dotEXT` exists
behind `GL_EXT_integer_dot_product`). It was already corrected. But **checking for it
surfaced a second one, still live, of a different kind**: two `dot`-family overload counts
both came to **50**, and the fixer had explained the coincidence as *"co-declared on shared
lines."* Measured: **zero lines contain both spellings.** They are both 50 by **symmetry** —
an identical 48-overload matrix plus 2 registrations, twice, independently.

Every number was honest at both ends, at every unit. What propagated was the **causal story
bolted onto the correct numbers**.

## The rule

⭐⭐⭐**A wrong count eventually contradicts something. A wrong mechanism never does — it
just gets cited.** That asymmetry is the whole lesson: a false figure collides with a later
measurement, a re-derivation, or an absurdity check. A false *explanation* of true figures
has **no failure signature at all**. It travels peer-to-peer exactly as readily as a figure
(this one moved from the fixer's message into the triager's store and sat there), and
nothing downstream ever forces a contradiction.

⇒ ⭐⭐**Two measurements agreeing on a number is not evidence they agree on a mechanism.**
Matching totals are consistent with parallel structure *and* with shared lines *and* with
coincidence — the totals alone cannot discriminate. ✅**One falsifying query settles what no
amount of control design can:** *"do any lines contain both spellings?"* → 0. That is the
check; a non-zero control on the counting instrument proves only that it reads.

## Why this lands on me specifically

I published mechanisms all night — the census defect, the `no_dispatch` impostor, the
stdout-on-404 trace — and in the same session a peer had to retract *"404s loudly"*, a
mechanism claim they had not verified, which I then built into my guard. **Mechanism claims
are the ones I am most fluent at producing and least able to falsify by re-reading**, which
is exactly the shape that survives. See [[feedback_mechanism_must_predict_observed_coordinates]]:
a mechanism must predict *where* the fault appeared. Add to it — **a mechanism offered as
the explanation of an agreement must name the query that would refute it**, or be labeled
as a guess.

Companion retraction from the same round, worth its own note: the fixer dropped a published
`42` as unreproducible under any pattern (48 declaration-shaped, 36 int/uint-only, 25 ESSL)
rather than retro-fitting a population to it. ⭐⭐**Back-fitting a definition to an
already-published figure is inventing rigour for a number instead of dropping it** — the
mirror image of over-retraction, and it reads as diligence.

See also [[feedback_deference_drifts_to_whoever_corrected_you_last]],
[[feedback_a_rollup_only_guard_makes_its_census_a_lucky_control]],
[[feedback_voiding_evidence_returns_to_unknown_not_to_the_prior_claim]].
