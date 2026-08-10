---
name: feedback_a_stored_claim_re_shipped_as_a_live_finding
description: "Quoting a figure out of my own state file into a report reads as a fresh measurement but is citing a conclusion whose premises were never re-checked — 4 instances in one hour, all caught by the recipient."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 65aeceb1-eb91-42c3-81c3-c0a233e60a7e
---

⛔ **A figure quoted out of my own state file is a CONCLUSION, not evidence — and it arrives at the reader as a measurement.**

Measured 2026-08-09, supervisor tick 127, **four instances in ~1 hour, every one caught by the recipient, none by me**:

| chain | what I re-shipped | truth |
|---|---|---|
| slang#12014 | *"4 cosmetic yields, no build coverage ever produced"* — carried **4 ticks**, sole basis of an operator escalation | **34 build/test jobs SUCCESS**, 0 failures, at merged head `72a3b5025d` |
| slang#12372 | resume trigger *"#12378 → MERGED"* | the `Fixes #12372` link the fixer **had refused on 08-07**, back as a scheduling dependency instead of a closing keyword — same false premise, now failing silently |
| slang#12388 | *"logs lapse ~2026-08-10"* | retention ~5d not ~7d; **the fixer had already retracted that date**; 08-03 logs were `410 Gone` days earlier |
| slang#12401 | inlined workflow patch is *"self-serve"* | `git apply --check` vs current master → **`patch does not apply`** (2 comment lines added upstream shifted the anchor) |

**Why it survives:** state is the *output* of prior reasoning, so quoting it feels like citing evidence. Nothing errors — the figure is well-formed, plausible, stable.

⭐⭐⭐ **The stored rule can be the thing that makes you wrong.** The fixer's framing, which is better than mine: *"'presence is the artifact test' was correct four times and became a reflex that nearly rejected the one materially different ask. A refusal that keeps getting vindicated is the most dangerous kind, because vindication feels like evidence."*

✅ **Checks that fire at the moment of writing:**
- Before quoting a figure from state: **name the command that produced it.** Can't? It's a conclusion.
- ⭐⭐ **Presence is not currency** — an artifact predating a decision cannot contain it; compare its `created_at` to the newest ruling's timestamp. (4 nudges tested presence and were false; the 5th tested currency and was right.)
- ⭐⭐ **A fix verified at authoring time is not verified as deployed.** An inlined patch's shelf life is measured in upstream commits; re-verify by extracting the diff back out of the **published** artifact, not the local file.
- **Re-read which noun the claim names before reusing yesterday's refutation.**

Distinct from a figure that was never true — see [[feedback_a_fabrication_inside_a_compliment_survives_unchecked]]. Same family as [[feedback_a_freshness_reading_expires]].
