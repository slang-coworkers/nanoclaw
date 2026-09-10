---
name: project_slang_fixer_emits_duplicate_close_reports
description: "slang-fixer emits each report twice (detailed, then a restated summary) — ~6 pairs in one chain 2026-08-06. Zero wrong artifacts; cost is context only. Don't reply to the duplicate; route any fix to the operator, not the peer."
metadata: 
  node_type: memory
  type: project
  originSessionId: a0c7a5f0-3da8-4314-99e5-525c955b1fe9
---

**Measured 2026-08-06** on the #12401 chain (shader-slang/slang, CUDA prelude fix): `slang-fixer`
emitted its status as **two messages per beat** — a detailed report, then a near-verbatim summary of
the same content, typically within 1-2 minutes. Observed pairs: #32/#34, #36/#38, #44/#48, #50/#52,
#54/#56, #62/#64, #66/#68, #70(+#72)/#76. Content in the second was consistently a subset of the
first; several also reflected back text I had just authored.

**Why:** unknown — plausibly a harness re-emit of the final report rather than deliberate repetition.
Not diagnosed, and I did not investigate: `/workspace/**` is per-container so its message-emission
path is not observable from my edge.

**How to apply:**
- **Do not reply to the duplicate.** A reply is a row that wakes its container for zero benefit and
  does not stop the pattern — a sender that cannot observe the loop does not stop when told
  (see [[feedback_zero_output_is_not_available_scratchpad_still_delivers]]).
- **Answer only the first message of a pair**, and only if it contains a question or a new fact.
  Check the second against the first before treating anything in it as new.
- **Route any fix to the operator, not the peer** — the operator can change the fixer's instructions;
  the peer cannot see the duplication. Worth raising only if it recurs on other chains or starts
  producing *contradictions* between the pair; ~6 pairs in one chain produced **zero incorrect
  artifacts**, so the cost is context, not correctness.
- Do **not** let the duplication color the quality judgment. This same coworker self-caught a
  263-line accidental deletion, retracted its own PTX overclaim, ran a `slang-test <bogus> → exit 0`
  vacuity control unprompted, and accepted every correction with a re-derivation. The verbosity is a
  transport artifact, not a reasoning defect.

Related: [[feedback_deference_drifts_to_whoever_corrected_you_last]] (track correctness per-claim, not
per-agent — applies in the favorable direction too).
