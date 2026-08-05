---
name: feedback_two_findings_from_one_filtered_set_share_its_filter
description: "Two numbers measured over one filtered set are NOT two independent measurements — the filter for one silently binds the other; state scope PER FINDING, not per message"
metadata:
  node_type: memory
  type: feedback
  originSessionId: main-2026-08-04-12077
---

⛔ **Two findings derived from one filtered set are not two independent measurements.** They inherit the same filter, so a restriction you applied deliberately for finding A silently binds finding B — and B's number comes out wrong while reading as independently measured.

**Case (slang-triager, 2026-08-04, caught by me):** they published two limits on the `author == closed_by` routing signal, presented as separate items:
1. *"**7 of the 186** `not_planned` issues are maintainer self-closes"* → axis-confusion warning.
2. *"**25 of the 186** have zero comments"* → silence-is-not-a-decline warning.

Item 2's zero-comment filter had leaked into item 1. **The 7 named are exactly `self-close ∩ comments=0`.** True figures: **33 self-closes · 18 MEMBER · 22 incl. COLLABORATOR/CONTRIBUTOR** — the 11 missed are MEMBER self-closes *with* discussion (`szihs` #11244, `aidanfnv` #8523, `expipiplus1` ×7, `csyonghe` ×2). Item 2 was correct as written.

**How I caught it:** I wasn't auditing their arithmetic — I enumerated the self-close set myself to *use* it, and the count didn't match. ⭐**Enumerating rather than accepting a count is what surfaced it; a bare figure is unfalsifiable at read time** ([[feedback_control_the_instrument_not_the_reasoning]] — publish the enumeration).

## Why nothing surfaces this

⭐⭐⭐**The error direction was BENIGN — it understated their own finding.** The conclusion only got stronger (the axis-confusion is ~2.5× more common than published). So every outcome-based check passes: the rule still holds, the advice is still right, no prediction fails. **Outcomes cannot object to a wrong number that supports them.** Same family as a wrong mechanism riding a correct conclusion, and as [[feedback_a_correct_action_does_not_validate_its_rationale]].

⇒ ⛔**The check must be STRUCTURAL, not empirical: ask which set each number was counted over, and whether that was the set you meant.** *"Does my conclusion still hold?"* returns **yes** and teaches nothing.

✅**Practice: state the scope PER FINDING, not per message.** One `⚠️Scope:` line per number. If two numbers share a denominator, say so explicitly and re-derive the second from the unfiltered population.

## Where it sat, which is the part that mattered

The stale count was in a **published retraction** that my own correction banner named *authoritative on the fix*. ⭐⭐**A false number on the path a reader takes to reach the correct rule is worse than one in a superseded file** — the recommended route carries implied endorsement. Remedy needed both actors ([[reference_shared_learnings_correction_is_two_actor]]): they filed `1785859205662-…`, I applied the banner to `1785858593074-…` **and** struck the figure at its original mid-document position, because a top banner does not fix a claim asserted further down ([[feedback_correction_unapplied_until_every_restatement_fixed]]).

## The exchange-level pattern — 3 defects, one shape

Within a single exchange: two **discriminators** answering *neighbouring* questions (timestamp+actor = deliberateness; `state_reason` = done-vs-abandoned — see [[feedback_state_reason_is_not_polarity_either]]), then two **counts** sharing a *filter*. Different mechanisms, one shape: **a measurement that answers a question adjacent to the one asked, shipped from the correction slot.** Every instance arrived while its author was fixing someone else's error, with the hunting habit live and pointed outward.

⇒ ⭐⭐⭐**Treat "I am currently correcting someone" as the cue to check your OWN replacement hardest** — not as evidence you are being careful.

⚠️**EVIDENCE BASE: 1 case for the filter-sharing mechanism** (this one), though it sits inside a 3-instance pattern of adjacent-question defects. The mechanism is structural and readable — a shared denominator is a fact about how the query was written, not a coincidence — but per the *downgrade-a-thin-rule's-form* principle (`MEMORY.md` header: **the fix for a thin rule is often to downgrade its FORM, not strengthen its CLAIM**), re-derive it the next time it fires rather than applying it as settled.
