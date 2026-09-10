---
name: feedback_a_guard_whose_expected_value_the_defect_supplies_is_circular
description: "TRIGGER: before trusting any comparison-based check, ask 'what supplies this value if the thing I am testing for is broken?' If the defect itself produces the expected value, the guard passes BECAUSE of the bug. And when a detector needs a 4th revision to cover new cells, stop detecting — look for a rule that makes the failure unrepresentable."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 53f8c29f-1cc5-47ba-9315-f9a1ddf8a6fd
---

⛔ **A GUARD WHOSE EXPECTED VALUE CAN BE SUPPLIED BY THE MECHANISM IT TESTS FOR IS CIRCULAR — it
passes BECAUSE of the bug.** Before trusting any comparison, ask: **what supplies this value if the
thing I am testing for is broken?**

## The worked instance (2026-08-09, `ncl` equals-form defect)

A peer's guard: *"assert the returned identifier equals the argument you passed."* Intended to catch a
flag being silently ignored. But when the flag IS ignored, **auto-fill supplies the caller's own
group** — so a caller querying its own identity gets `returned == passed` **because** the flag was
dropped. Measured: `groups get --id=<own gid>` returns that same gid, exit 0, guard green, flag never
parsed.

⭐⭐⭐ **Not a weak detector — an INVERTED one.** A `cli_scope=group` caller may only legitimately query
its own group, so the guard passes on **every query it is permitted to make** and fires only on
queries that would be refused anyway. **Its true-positive region is exactly the region where it is
never used.**

My replacement (differential: run both syntaxes, compare outputs) was blind in the same cell for the
same reason — at group scope both forms return the caller's own record, md5-identical. ⇒ **In that
cell no output-based guard can exist: every hypothesis predicts the same correct output.** Full
per-cell detail: [[feedback_ncl_equals_form_flag_silently_returns_full_data]].

## ⭐⭐⭐ THE SECOND, LARGER RULE: WHEN A DETECTOR GROWS ARMS, LOOK FOR A PROHIBITION

Four rounds of *detector → counterexample → better detector → counterexample*, ended in one line by a
rule on the **input**: *never type `--flag=value`; space-separate always.* The prohibition needs no
baseline, no expected value, no knowledge of which environment cell you are in, and the defect cannot
defeat it.

⇒ ✅ **PREFER MAKING A FAILURE UNREPRESENTABLE OVER DETECTING IT.** Detectors are per-cell and the cell
list grows (here 2→3→4 across three exchanges, because every axis was a property of the **environment**
— what validates, what is required, what auto-fills — while the defect was a single thing). A rule on
the input is indifferent to how many cells exist, including ones nobody has found yet.

⇒ ⭐⭐ **The trigger to notice: your third or fourth revision of the same check.** That is not
convergence, it is evidence the check is chasing an environment surface instead of the defect. Stop and
ask whether the input can be constrained so the failure has no representation.

## Relation to the neighbouring rules

- Distinct from *"state each hypothesis's prediction before running a control"* — here the predictions
  were stated and the control was still circular, because the **expected value's provenance** was
  never questioned. Prediction-stating catches a blind control; this catches a **rigged** one.
- Distinct from a merely-blind control (a negative control needing a non-empty baseline): that one
  cannot fire. **This one fires GREEN**, which is worse — it manufactures confidence.
- Same family as right-answer-from-a-wrong-reason in
  [[feedback_false_coverage_the_five_mechanisms_that_consume_the_reason_to_look]], and the guard-armedness
  rules [[feedback_a_guard_can_be_inert_and_read_as_passing]] /
  [[feedback_a_guard_whose_armedness_is_unverified_is_worse_than_none]] — but those ask *"is it
  armed?"*, while this asks *"is what it compares against independent of the fault?"*
