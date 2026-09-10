---
name: feedback_an_empty_failure_set_needs_a_denominator
description: "A set of failing names with no count of what was MEASURED cannot distinguish 'ran clean' from 'never ran' — the two are byte-identical. Prove it by stripping the new cell and watching both states collapse to one string."
metadata:
  node_type: memory
  type: feedback
---

# An empty failure set with no denominator reads as green when it means UNMEASURED

Measured 2026-08-08 10:2xZ on `i12371-pr-guard.sh` (ninth defect on that latch). The fingerprint
carried the sorted set of failing check-run names — the cell added one wake earlier, by the eighth
fix, specifically so a real build failure could not hide. A push landed and the cell went
`{check-ci, wait-for-human-priority}` → **empty**. Read literally: the red PR turned green.

The truth was the reverse. At the old head a `workflow_dispatch` CI run existed whose two gate jobs
failed (84 rows: 2 failure / 74 skipped / 8 success). At the new head only the `pull_request` run
exists, and `ci.yml`'s `filter` job carries
`if: github.event_name != 'pull_request' || github.event.pull_request.draft != true`, so on a **draft
PR the entire workflow concludes `skipped`** — 48 rows: 0 failure / 45 skipped / 3 success, with all
33 build/test rows skipped. **The failing set emptied because the measurement disappeared.**

**Why:** a set of failures is a numerator. Without the denominator — how many things actually
produced a verdict — "nothing failed" and "nothing ran" are the same value, and the second is the
state that precedes every silent regression. This is [[feedback_a_denominator_hunt_silently_asserts_the_numerator]]
inverted: there the numerator was assumed, here it was measured and the denominator was missing.

**How to apply:**
- Any latch or report keyed on a set of failures carries a count of rows that reached a real
  conclusion alongside it (`success` or `failure`; `skipped` is **not** a measurement). Cell shape
  `m<N>`; `m0` means UNMEASURED and is a distinct state from "measured and clean".
- **Prove the blindness mechanically, not by argument.** The control that settles it: strip the new
  cell from both the seeded prior state and the live one, and check whether the two strings become
  byte-identical. They did. A retroactive seed alone only shows the new cell *can* fire; the collapse
  shows the old field set *could not*. Stronger than the eighth fix's control, which needed me to
  reason about what a count would have shown.
- **Read the sibling before designing the fix.** `pr12200-guard.sh` already keyed its wake on exactly
  this quantity (`subst` = `build-|test-|sanitizer` rows concluding `success|failure`) and had since
  it was written. Second time that same sibling was right where this file was wrong — the seventh
  defect was the identical pairing. ⇒ When a defect is found in one of a family of scripts, diff
  against the family **first**; twice the correct shape was already written 20 lines away.
- Stub ordering trap, third instance: a `case` arm matching `*per_page=1` prefix-matches
  `per_page=100`, so the injection lands on the wrong guard and passes for the wrong reason. Put the
  page-loop arm first, and always read WHICH guard fired — [[feedback_a_bail_is_not_a_pass]] if that
  leaf exists.
- When a fix widens the fingerprint FORMAT, do not restore the pre-widening string as "the true
  latch": the next real fire would differ on the format change alone and wake on nothing. Store the
  new-format encoding of the state you actually read this wake, and restore `lastwake` (the budgeted
  value) untouched.

See also [[feedback_a_cap_that_is_slack_at_rest_binds_when_the_state_changes]] — same family: a probe
that is correct at rest and wrong in exactly the state you built it to observe.
