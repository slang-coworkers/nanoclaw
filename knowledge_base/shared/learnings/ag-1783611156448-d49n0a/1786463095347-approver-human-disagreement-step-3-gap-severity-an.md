---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1786441563425-oyhtal
written_at: 2026-08-11T15:44:55.347Z
---

# [approver/human-disagreement] Step-3 gap severity: an abstain performs conscientiousness — verify its premises as hard as an approval's, and count the reversal direction

## Symptom
On slangpy#1100 my decision moved WOULD_APPROVE → ABSTAIN_POLICY:OPEN_GAP →
WOULD_APPROVE across three DECISION_REVIEW rounds. The abstain rested on two
premises I had never verified: that a deferred-pipeline's native-handle
consequence was "silent" and "untested". Both failed verification —
`NativeHandle::is_valid()`/`operator bool` make it checkable, ignoring the
`getNativeHandle` rc is pre-existing repo convention, and the underlying RHI
result is tested upstream (a test line I had literally printed earlier in the
same session). The PR later merged at exactly my pinned head with no human
review — so the abstain, had it stood, would have been a false disagreement
caused by unverified premises, not genuine caution.

## Root cause
Two biases pulling the same way, and I only guarded against one:
1. I told myself the *approval* was "the flattering call" (it costs no abstain
   against the infra/policy quality gate) and used that to justify flipping to
   abstain. But an ABSTAIN also flatters — it *performs conscientiousness* — and
   deferring to a reviewer who has just caught you is the path of least
   resistance. Neither direction is self-verifying.
2. The first clear was genuinely under-argued (I wrote "unreachable" / "timing
   not results" where evidence supported only "no in-tree caller" / "results
   unchanged for compiled programs"). Over-correcting a real weakness into an
   abstain on FRESH unverified premises is not a fix; it trades one
   unsubstantiated claim for another.

## How to catch it
- Before recording an OPEN_GAP, verify its load-bearing premises against source
  with the SAME rigor you'd demand of an approval. "Silent" and "no test covers"
  are claims requiring a read (of the surfacing code, and of the test tree), not
  intuitions.
- When a change's "gap" is that its own opt-in feature changes behavior, ask if
  that is a real gap or a restatement of the feature. Check the DEFAULT: if the
  trigger's default leaves existing callers unchanged (here
  `pipeline_compilation_mode` defaults to `serial`), the behavior change is
  scoped to users who opt in — which is the intent, not a defect.
- Notice the reversal direction. approve→abstain→approve under reviewer pressure
  is a signal you may be landing where the last reviewer pointed rather than on
  verified fact. Re-derive from artifacts, not from the critique.

## Fix
An abstain is not the "safe" default — it is a decision that asserts "a human
must look", and a wrong one wastes a human's attention and corrupts calibration
just as a wrong approval does. Hold both directions to the same evidence bar.
Related: [[verify-each-claim-on-its-own-evidence]], core memory "audit
corrections in both directions".
