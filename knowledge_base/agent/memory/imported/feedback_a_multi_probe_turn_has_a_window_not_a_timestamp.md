---
type: feedback
name: feedback_a_multi_probe_turn_has_a_window_not_a_timestamp
description: "A multi-probe turn has a measurement WINDOW, not a timestamp: each fact is stamped at its own probe and a later probe can invalidate an earlier one, so re-probe what a decision rests on right before shipping. Decline a peer's unverified absolution as you would their unverified blame. fetched==total_count is a TRUNCATION guard, not a COMPLETENESS one. (slang-rhi#811 R2, 08-05; diligence-slot and stopping lessons split out 10-16.)"
metadata:
  node_type: memory
  type: feedback
  tags:
    - measurement
    - verification
    - slang-rhi
    - approver
    - staleness
  originSessionId: pending
---

# A multi-probe turn has a window, not a timestamp (slang-rhi#811 R2, 08-05)

Early in a turn I probed `pulls/811` → `requested_reviewers: []` and built a load-bearing policy question on it ("author removed both reviewers"). It was stale: `bmillsNV` was re-requested at **14:07:36Z**. Later in the SAME turn I read a CodeRabbit comment with `updated_at` **14:08:49Z** — proving my wall-clock had passed the change point — yet I shipped probe A's result as current without re-probing.

⇒ ⭐⭐⭐ **A multi-probe turn has a measurement WINDOW, not a timestamp. Every fact is stamped at ITS OWN probe, and a later probe in the same turn can silently invalidate an earlier one.** The turn feels instantaneous from the inside, so "I just measured this" is an illusion once the turn holds more than one call. ⇒ **Re-probe the facts a decision RESTS on immediately before shipping** — batch the load-bearing probes at the end, or note the latest timestamp any probe returned and treat every earlier fact as suspect past it.

⛔ **AMENDMENT (I over-retracted first).** The honest version: my output was enough to know the fact was **UNVERIFIED** at ship time, never enough to know it was **FALSE** — proving false needs the 14:07:36Z change point, which nobody held until the approver's later GraphQL probe. **A self-criticism that requires information you didn't have is not a lesson; it's a story.** The weaker claim is the more useful one because it is actionable at ship time without hindsight ("this fact is older than my latest probe — re-check it"). The predictive test still discriminates: the weaker claim predicts the error, so the discipline survives while the dramatic framing does not ([[feedback_void_the_execution_claims_keep_the_source_claims]]).

## ⭐⭐⭐ Declining the charity is the actual lesson

The approver's *"it was true when you stamped it"* was an unverified claim about my state, offered in my favour; accepting it would have buried a mechanical probe-sequencing defect under "sometimes facts just go stale." Mirror of the R1 exchange where I refused to inherit their `testing.cpp:794` read ([[feedback_a_config_conditional_mechanism_needs_the_config_read]]). ⇒ **The rule is symmetric and I had applied only one half: don't inherit a peer's unverified read when it hurts you, AND don't inherit their unverified absolution when it helps you.** The favourable direction is the one that never prompts a re-check ([[feedback_a_candid_disclosure_gets_less_scrutiny_not_more]]).


## ⛔ `fetched == total_count` is a TRUNCATION guard, not a COMPLETENESS guard

At dispatch `fetched=20 == total_count=20` ⇒ my check passed; after the run, `total_count=21` (a `finish` check-run created ~13 min later). `fetched == total_count` proves **the page was not truncated**, nothing about whether the check set is **final** — new check-runs get created over a run's lifetime, so "20 of 20" is only "20 of 20 so far." ⇒ **For completeness, read the RUN** (`actions/runs/<id>` → `status`/`conclusion`), not the check-run count ([[feedback_false_coverage_the_five_mechanisms_that_consume_the_reason_to_look]]).


## Split out 2026-10-16

- Self-accusation and credit as unaudited diligence slots, the error census that cannot see
  self-catches, the pre-flight self-consistency check, and the two-actor closeouts from this exchange:
  [[feedback_self_accusation_and_credit_are_unaudited_diligence_slots]].
- The six rounds that ran after the verdict went terminal, and why an injected rule did not stop them:
  [[feedback_stop_a_converged_exchange_the_yield_curve_bends]].

## Outcome (for the record, not the lesson)

Approver reached **ABSTAIN_POLICY / `CHALLENGER_CONCERN`** on `2a3524d8` — 6/6 clauses pass, CI green, CodeRabbit genuinely reviewed the head, 0 🔴 — but abstained on the **WIP declaration**: `WOULD_APPROVE` claims *ready-to-merge* while the artifacts establish only *sound*, and only the author can speak to readiness. It correctly did NOT reuse `NO_REVIEW_SIGNAL`. Flagged gap: no `author_declared_ready`/`not_wip` predicate exists, so the one thing that stopped the approval is invisible to the script.
