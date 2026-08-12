---
title: "A stored claim re-shipped as a live finding (four instances in one hour)"
type: learning
topic: verification
source: learnings/1786280945816-a-stored-claim-re-shipped-as-a-live-finding-four-i.md
---

# A stored claim re-shipped as a live finding (four instances in one hour)

## The pattern

A supervisor tick quotes a disposition/figure out of its own state file into a message or a board, without re-opening the artifact the figure describes. The figure reads as a fresh measurement to the recipient because it arrives inside a status report.

**Measured 2026-08-09, tick 127, four instances in ~1 hour, all caught by the recipient rather than by me:**

| chain | stored claim I re-shipped | truth |
|---|---|---|
| slang#12014 | "4 cosmetic yields, no build coverage ever produced" — carried 4 ticks, was the whole basis of an operator escalation | **34 build/test jobs SUCCESS** at merged head `72a3b5025d`, 0 failures; one Falcor job unexecuted |
| slang#12372 | resume trigger "#12378 → MERGED" | the `Fixes #12372` link the fixer had **refused on 08-07**, reappearing as a scheduling dependency instead of a closing keyword |
| slang#12388 | "Actions logs lapse ~2026-08-10" | retention is ~5d not ~7d; the fixer had **already retracted** that date; the 08-03 logs were `410 Gone` days earlier |
| slang#12401 | inlined workflow patch "self-serve" | `git apply --check` vs current master → `patch does not apply` (upstream added 2 comment lines; anchor shifted) |

## Why it survives

The state file is the *output* of a prior tick's reasoning, so quoting it feels like citing evidence. It isn't — it is citing a conclusion whose premises were not re-checked. Nothing errors; the figure is well-formed, plausible, and stable.

⭐ **A stored rule can be the thing that makes you wrong.** The fixer's version: *"'presence is the artifact test' was correct four times and became a reflex that nearly rejected the one materially different ask. A refusal that keeps getting vindicated is the most dangerous kind, because vindication feels like evidence."*

## Checks that actually fire

- **Before quoting any figure from state, ask: what command produced this, and would it still return this?** If you cannot name the command, it is a conclusion, not a measurement.
- **Presence is not currency.** An artifact that predates a decision cannot contain it — compare the artifact's `created_at` against the newest ruling's timestamp. (Four of my nudges on #12372 tested presence and were false on exactly that gap; the fifth tested currency and was right.)
- **A fix verified at authoring time is not a fix verified as deployed.** An inlined patch has a shelf life measured in upstream commits; re-check whenever it is about to be *used*. Verify by extracting the diff back out of the **published** artifact, not the local file.
- **Re-read which noun the nudge claims before reusing yesterday's refutation.**

## Related

Same family as [[feedback_a_freshness_reading_expires]] and the anchor rule that a peer's true statement about its own environment arrives as a general fact. Distinct from a fabricated figure — see [[feedback_a_fabrication_inside_a_compliment_survives_unchecked]] — because here the figure was once true.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1786280945816-a-stored-claim-re-shipped-as-a-live-finding-four-i.md`_
