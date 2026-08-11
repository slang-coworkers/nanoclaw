---
name: feedback_an_elapsed_time_figure_drifts_because_nothing_recomputes_it
description: "I shipped '~N h since the shepherd was assigned' 8 times over 36 wall-clock hours; it went 35→55→78→89→113→118→136→131 while only 36 h passed, and DECREASED once. A stored figure re-typed by feel is not stale — it was never computed. Range-check: elapsed time is monotone and bounded by (now - a fetchable anchor)."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: dfd5edcd-1812-4453-bab7-d14fc9d92e11
---

⛔ **An elapsed-time figure I re-type each wake is not a measurement that went stale — it is a number that was never computed at all, and it DRIFTS UPWARD because "longer than last time" always feels right.**

Measured 2026-08-09 13:4xZ on the #12371 guard chain, by grepping my own `messages_out` for
`\d+\s*h\s+(after|since)` and differencing against the anchor's own API timestamp:

| shipped at | to | claimed | true (jkwak-work assigned issue 08-06T18:16:13Z) | true (review requested on #12382 05:58:29Z) |
|---|---|---|---|---|
| 08-07 17:24 | dashboard | ~35 h | 23.1 | 35.4 |
| 08-08 09:58 | **slang-fixer** | ~55 h | 39.7 | 52.0 |
| 08-08 11:32 | dashboard | ~78 h | 41.3 | 53.6 |
| 08-08 12:29 | dashboard | ~89 h | 42.2 | 54.5 |
| 08-08 13:17 | dashboard | ~113 h | 43.0 | 55.3 |
| 08-08 22:06 | dashboard | ~118 h | 51.8 | 64.1 |
| 08-09 01:36 | dashboard | ~136 h | 55.3 | 67.6 |
| 08-09 05:36 | dashboard | ~131 h | 59.3 | 71.6 |

⭐⭐⭐ **Two detectors, both free, both would have fired without knowing the true anchor:**
1. **MONOTONICITY.** `136 → 131` **decreased**. Elapsed time cannot decrease. One comparison against
   my own previous message kills it — no API call, no anchor, no arithmetic.
2. **INCREMENT vs WALL CLOCK.** Between the 12:29 and 13:17 messages **0.8 h** of wall clock passed and
   the claim advanced **+24 h**. Differencing consecutive claims against consecutive send timestamps
   exposes every row: gaps of 1.6 h / 0.9 h / 0.8 h / 3.5 h carried +23 / +11 / +24 / +18.

✅ **Robustness of the finding, stated so it cannot be argued away by anchor choice:** even against the
**earliest** anchor in the entire chain — issue #12371's own `created_at` 08-05T20:49:24Z, which no
reading of "since the shepherd was assigned" could justify — the last six figures are still impossible
(excess **+15.3 … +59.2 h**). ⇒ **There is no anchor under which they are true.** I checked three real
candidates (issue assignment, PR-12382 review request, PR-12408 review request) and the generous
outlier; the claim exceeds all four.

⛔ **Why it survived 8 shippings and ~10 wakes:** every wake I re-measured *head shas, check-run
censuses, mergeable, review counts, timeline events* from the API — and copied this one figure from
the previous message's prose because it lived in a `**Status:**` bullet **beside** freshly-measured
values. ⭐⭐⭐ **A fabricated number sitting inside a list of verified numbers inherits their
credibility.** The re-measurement discipline was real and it had a hole exactly where the value had no
producing command.

⭐⭐ **It is ANCHOR-G's shape with the premise removed.** G says a stored figure is a *conclusion whose
premises were never re-checked*. This one had **no premises** — nothing ever computed it, so there was
no earlier correct value to go stale. **G's check ("name the command that produced it") catches it, and
I never ran G's check on this figure because I never thought of it as a figure — it read as a phrase.**
⇒ **Prose-shaped quantities ("a couple of days", "~N h after X") evade a figure-audit that greps for
numbers-as-data.**

✅ **Checks that fire at the moment of writing:**
- **Any "N units since/after X" ships with the anchor's own timestamp inline**, so the reader can
  divide: *"0 reviews, 67.5 h after `jkwak-work` was assigned the issue (08-06T18:16:13Z)"*. An
  un-anchored duration is unfalsifiable by the reader, which is why nobody caught it.
- **Range-check by monotonicity before sending**: is this ≥ the last value I shipped, and is the
  increase ≤ the wall-clock gap? Both violations are detectable with zero external state.
- **Compute durations, never carry them.** A duration is the one class of figure that is *guaranteed*
  wrong on re-use — unlike a sha or a file md5, it is false the instant it is stored.
- **Grep your own `messages_out`, not your memo, when auditing what a peer was told.** The memo had
  these values too, but the operator's belief lives in the delivered rows.

Same family as [[feedback_a_stored_claim_re_shipped_as_a_live_finding]] (stored conclusion re-shipped)
and [[feedback_a_freshness_reading_expires_the_moment_you_stop_looking]]. Distinct from
[[feedback_a_fabrication_inside_a_compliment_survives_unchecked]]: there the falsehood hid behind
praise; here it hid behind **neighbouring true figures**. Detector kinship with
[[feedback_deference_drifts_to_whoever_corrected_you_last]]'s range-check rule — *absurdity beats
agreement as a detector* — which is precisely what `136 → 131` was.
