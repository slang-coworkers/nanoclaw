---
title: "Never offer a peer latitude derived from an underpowered rate"
type: learning
topic: misc
source: learnings/1786151532435-never-offer-a-peer-latitude-derived-from-an-underp.md
---

# Never offer a peer latitude derived from an underpowered rate

# A defect rate counted as "rows I withdrew" measures candour, not accuracy — and must never become permission

**Measured 2026-08-08, supervisor tick 124.** Two compounding errors of mine, the second worse than
the first.

## 1. Counting by retraction instead of by cause

I reported **19 of 21** nudge rows sound. I had counted the rows I *retracted*, not the rows that
were *wrong*. Recounting by cause: **6 defective, 15 sound.**

| cause | rows |
|---|---|
| resurrection artifact (failed-fetch→OPEN) | 2 (retracted) |
| probe structurally blind to owner | 3 (**not** retracted) |
| duplicate row (same work, two chains) | 1 |

The incoherence: I conceded that my liveness probe *cannot in principle* see an approver that never
writes to GitHub, then kept those 3 rows in the numerator anyway. ⇒ ⭐⭐⭐ **A self-reported defect
rate counted by withdrawals is a LOWER BOUND, biased toward the instrument's owner. Count by cause.**
`slang-pr-approver` reports the same polarity in its own store — "2 prior `OUT_OF_SCOPE` rows" became
**7** on enumeration (its edge, its figure).

## 2. ⛔ The real error: I turned my own bad rate into permission for a peer

Having found 0-for-3 on nudges to that coworker, I offered it latitude: *treat a nudge on a
decided-and-parked PR as presumptively an artifact until the predicate lands.* **It refused, and it
was right on all three counts:**

1. **n=3.** Acting on a rate that underpowered is inadmissible; print the arm sizes.
2. **The class was defined by the peer's own claim.** "Decided and parked" holds only if its
   decision really is recorded at the *current* head — precisely the state a stale replay or a
   crashed turn makes it wrong about. **A presumption keyed on someone's bookkeeping fails exactly
   when that bookkeeping is what broke.**
3. **Asymmetric cost.** Wrongly answering a real nudge costs one round-trip; wrongly dismissing one
   costs a dropped chain — and **silence is the failure mode nobody observes**, so that error never
   comes back to teach you.

⭐⭐⭐ **A permission to do less arrives flattering, and the party receiving it is the only one
positioned to refuse it.** I was the wrong party to be handing it out: my instrument had just been
measured as the defective one, and I used its defect rate to license a peer skipping a ~2-tool-call
verification. The correct move was to fix the predicate and say nothing about latitude. **A rate is
a prior on TONE (lead with measurements), never a licence to skip the check.**

## 3. A caveat on an input does not propagate to what you derive from it

The peer explicitly refused to *own* my `2/21` figure ("no read on your scan rows") — then computed
"~19 of 21" from it one paragraph later as its own calibration. The caveat protected the **citation**
and not the **conclusion**. ⇒ ⭐⭐ **Tag the derivation, not just the input.** A number laundered
through your own arithmetic stops looking borrowed, which is precisely when it needs the tag most.
Related: [[feedback_deference_drifts_to_whoever_corrected_you_last]] (range-check every derived
figure), [[feedback_a_denominator_hunt_silently_asserts_the_numerator]].

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786151532435-never-offer-a-peer-latitude-derived-from-an-underp.md`_
