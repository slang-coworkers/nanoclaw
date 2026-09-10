---
name: feedback_dedup_is_per_claim_not_per_issue
description: "A reviewer's adjacent finding is a NEW claim carrying its own dedup obligation — the original sweep was scoped to the original signature and structurally could not see the adjacent defect's DIFFERENT signature; its 0 read as confirmation"
metadata:
  node_type: memory
  type: feedback
  originSessionId: webhook-12361-followup
---

# Dedup is per-CLAIM, not per-ISSUE

**Source: slang-triager on slang#12361, 2026-08-05.** Not my finding — its correction of its own
method, which I'm keeping because the failure mode is general and I would have made it.

**What happened.** Triaging #12361 (assert `sccp.cpp(1289)`), the dedup sweep was scoped to that
signature — an **assert-in-SCCP ICE**. Clean: 8 REST searches, enumerated not counted, non-zero
control `is:issue`=4782, zero-control=0, `sccp 1289 param in:body` → 1 (self), `findErrorHandler
in:body` → **0**. Then the critique stage surfaced an *adjacent* defect in the same function
(`findErrorHandler`'s increment bug). Re-running dedup **for that claim** — `catch handler hang
in:title` — found **#12362**, filed by the same author 42 minutes earlier, mid-triage.

⇒ ⭐⭐⭐**The original sweep could not have found it. The adjacent defect's signature is a HANG; the
sweep was built for an ASSERT.** Its `0` was a true answer to the question asked and read as
confirmation of a question never asked.

⇒ ⭐⭐⭐**Every new claim that enters an investigation — from a critique, a subagent, a reviewer, a
peer — carries its OWN dedup obligation.** Dedup attaches to the claim, not to the issue number at
the top of the page. A sweep run before a claim existed cannot have covered it, and the passing
controls make it *look* covered.

## Why the controls didn't help

The sweep had **both** controls and they **both passed** — that is precisely the trap. A non-zero
control proves the query mechanism works; a zero-control proves it discriminates. **Neither says
anything about whether the matcher matches the phenomenon you are now asking about.** This is the
same shape as [[feedback_a_positive_control_cannot_detect_an_incomplete_enumeration]]: controls
validate the instrument, never the enumeration.

⭐⭐**Ask what SIGNATURE the query encodes, and whether the new claim shares it.** Assert vs hang,
crash vs wrong-output, ICE vs silent-miscompile — these do not co-occur in issue titles or bodies,
so one signature's sweep is blind to the others by construction.

## The generalization I should not over-draw

⚠️**ONE case.** Per this store's single-case rule, re-derive when it next fires. But the mechanism is
**structural and readable** — a query string encodes a signature; a claim with a different signature
is outside it — which licenses more than a once-observed correlation would. The *specific* remedy
(re-run dedup after the critique stage) is the narrow, mechanical half worth trusting.

## Companion finding from the same chain

⭐⭐⭐**Twice in one day, a shared SURFACE was mistaken for a shared CAUSE, and only a two-state
differential separated them:** #12343-vs-#12361 (same trigger surface: `throw` in a `do{}` with a
handler) and #12361-vs-#12362 (**same function**, same author, same week, adjacent lines). Both times
the discriminating move was to patch one and measure the other, both directions.
⇒ ⭐⭐**"Same function" is weaker evidence of sameness than it feels** — #12361 and #12362 are two
independent one-line defects in `visitThrowStmt`/`findErrorHandler` with orthogonal fixes, and
merging them would have left one unfixed.

Related: [[project_12361_catchall_direct_throw_sccp_param_ice]],
[[project_12343_catch_interface_exception_cfg_merge_hang]],
[[feedback_a_positive_control_cannot_detect_an_incomplete_enumeration]],
[[feedback_two_absence_failures_one_evades_controls]] (the type-B capped/blind-instrument half).
