---
title: "A DERIVED FIGURE OUTLIVES THE CORRECTION OF ITS INPUTS — three instances in one session; compute at render, or drop the number and keep the qualitative claim"
type: learning
topic: verification
source: learnings/1786042159569-a-derived-figure-outlives-the-correction-of-its-in.md
---

# A DERIVED FIGURE OUTLIVES THE CORRECTION OF ITS INPUTS — three instances in one session; compute at render, or drop the number and keep the qualitative claim

## The pattern

A number written *about* other data goes stale the moment that data is corrected, and nothing flags
it — the figure still looks settled, so nobody re-derives it. Three instances in a single session on
slang#12284:

1. **A count above the list it describes.** Header said "6 wrong citations" over a list of **7**; I'd
   written the count, then appended a row and never re-counted.
2. **A subtraction assuming a two-state population.** `39 marks − 9 confirmed = 30 recovered`, while
   retries were still running: the population was actually
   `confirmed + recovered + STILL_PENDING`. Final truth was **25 confirmed / 14 recovered** — the
   early figure overstated recovery by 2×, i.e. understated the pre-existing failure count, the
   dangerous direction.
3. **An offset table describing superseded values.** I documented per-site line drift as
   `+67/+68/+71/+75/+76` — then corrected several of the citations those offsets were computed from.
   The list silently kept describing numbers that no longer existed, in the very document whose point
   was that citations must be verified.

Note #3's irony: the stale figure was inside the paragraph warning against stale figures. Proximity to
the lesson provides no protection.

## The remedies, in order of preference

1. **Compute at render.** `f"{len(pairs)} wrong citations"`, never a typed digit. My delta script now
   derives every total from the data it just parsed.
2. **Report a sum-check, not a difference.** `25 + 14 == 39` cannot hide a third state; `39 − 25`
   silently assumes there are only two. Assert `pending == 0` rather than inferring it.
3. **Write the figure last**, after the underlying set stops changing. Any number authored before its
   inputs are final is stale by default — a **write-order hazard**, not carelessness.
4. **Drop the number and keep the claim.** This is underrated. "Drift varies per region within a
   single patch, so no offset validates the set" is *stronger* than the same sentence plus a specific
   list — because the list invites a reviewer to check it and find it inconsistent, which discredits a
   correct argument. Cite the *mechanism* (or the checker script) instead of the measurement, when the
   measurement is illustrative rather than load-bearing.

## Detection

Grep your own artifact for digits before shipping and ask of each: *is this computed, or typed?* If
typed, *what would have to change for it to become wrong, and has that changed since I typed it?*
Counts, offsets, differences, and "N of M" phrasings are the high-risk forms.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1786042159569-a-derived-figure-outlives-the-correction-of-its-in.md`_
