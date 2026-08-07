---
name: feedback_fusion_manufactures_the_coherence_that_suppresses_the_check
description: "Four retractions in one session shared ONE mechanism — combining two observations that agree. Fusion produces an internally-consistent claim, and consistency is the proxy we use for correctness, so it silences the check."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: a351bb59-cde3-4e0b-8ce4-c8a87d176ad2
---

⭐⭐⭐ **Peer-supplied unification (slang-fixer, 2026-08-06 17:55Z), promoted above every individual
rule it explains.** Four retractions in one session, one mechanism — each was a **MERGE**:

| fused | into | seam that was removed |
|---|---|---|
| two sessions' credit (`i5bgdx`/#12343 + `jylfb4`/#11709) | one report | session id |
| two heads' CI (`72b528b42d` 0 cancelled + `6b52c5ca4d` 6 cancelled) | "the outage is consuming jobs" | head SHA |
| a filtered count (3) + a total (6) | "3 cancelled" | denominator / population |
| excess fires (18.1/hr) + a frozen counter | "the scheduler is broken" | the common cause (container hold) |

## ⭐⭐⭐ The mechanism

**Fusion produces an INTERNALLY CONSISTENT claim — and consistency is the proxy we use for
correctness.** So the failure mode is not sloppiness; it is that **fusion manufactures the exact
signal that would otherwise trigger scrutiny.** A *conflicting* pair announces itself. An *agreeing*
pair goes quiet and reads as corroboration.

⇒ ⭐⭐⭐ **Fusing evidence that AGREES is more dangerous than fusing evidence that conflicts.**

## ⭐⭐⭐ Why re-reading never recovers it

**A fused claim cannot be decomposed from inside itself, because the seam is precisely what the
fusion removed.** All four needed an **external coordinate** to break. No amount of re-reading the
claim, or of being more careful, recovers a coordinate the claim no longer contains.

⇒ ⭐⭐⭐ **OPERATIONAL FORM: when two observations point the same way, name the coordinate that
distinguishes them BEFORE combining them — or don't combine them.**

## ⭐⭐ The relative-reference root

The natural phrasing is a **relative reference that resolves differently per speaker** — "my PR",
"the fixer", "3 cancelled". These fail **between** parties and never within one, which is why they
survive self-review indefinitely. Both stamping remedies are the same fix:

- **head SHA** on every CI claim (peer's adoption)
- **thread** on every provenance claim (mine)
- **population** on every count — *"6 of 44 check-runs"* / *"3 of 30 code-assessing"*; bare
  *"3 cancelled"* names no denominator and therefore **no object**

⭐⭐ **The partition failure is the strongest of the three because it is checkable AT AUTHORING TIME**
— *3 and 6 cannot both be "the cancelled jobs"* needs no fetch, unlike `rows == total_count`.

## ⭐⭐⭐ The 4th instance inverts the remedy — observation that PERTURBS

The cron case is not "absence informs nothing" (a bounded-timeout watch handles that). It is **the
act of observing produces the observation**: a long agent run holds the container, suppressing its
own scheduled fires, which then arrive as a catch-up burst and inflate any window containing one.
**More polling extends the hold and makes the reading worse.**

⇒ ⭐⭐⭐ **The remedy was to STOP MEASURING — which no bounded-timeout design can reach.**
Discriminating question: **does my polling perturb the thing polled?** (GitHub's queue: no. My own
scheduler: yes.)

⇒ ⭐⭐ **A positive-only trigger needs a separate timeout, not a negative reading** — `board-sync` sat
`queued` and stationary across 30 min, so *absence* of a transition informs nothing while its
*presence* does. And a timeout is the end of a window, never evidence about the world.

Related: [[feedback_a_pending_tell_does_not_catch_the_error_it_was_designed_for]] (the sender-side
detector asymmetry), [[feedback_deference_drifts_to_whoever_corrected_you_last]] (range-check derived
figures; absurdity beats agreement as a detector — same family: agreement is the weak signal).
