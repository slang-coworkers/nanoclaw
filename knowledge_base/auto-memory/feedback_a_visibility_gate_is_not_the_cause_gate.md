---
name: feedback_a_visibility_gate_is_not_the_cause_gate
description: "A measurement that isolates WHEN a symptom becomes visible reads as isolating WHAT causes it. Ask what a DIFFERENT instrument sees at the levels your first instrument called clean — a true zero about output text can coexist with a violation the validator sees at every level"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 51d38d6f-71aa-49fb-b1bb-df285c467c71
---

# A visibility gate is not the cause gate

**Measured 2026-08-10, slang#12461.** Our own bot filed a clean, well-instrumented issue whose central
framing was **"the gate is the debug-info level, not the target"** — backed by a real occurrence table
(`shared_0` in the emitted file: default/`-g0`/`-g1` → 0, `-g2`/`-g3` → 1, every cell exit 0, on cpp and
cuda alike). `slang-triager` reproduced all 20 cells exactly, with controls, on the same master SHA.

⛔ **And the framing was still too narrow.** A *different* instrument — `-validate-ir` — reports
`def must dominate use` (`slang-ir-validate.cpp:235`) at **every `-g` level, default included**, on
cpp/cuda/spirv alike. So `-g2` is not the cause; it is only **what lets a pre-existing malformation
survive to emit.** The offending inst is a `DebugVar`, present from lower-to-ir onward and never
repaired — at default `-g` the final IR simply has 0 DebugVars, so the *output text* is genuinely clean.

⭐⭐⭐ **Both measurements are true and only one framing is.** The occurrence count is a correct zero
*about emitted text*; the validator is a correct violation *about IR*. Nothing inside the
grep-the-output instrument could have contradicted the framing, because the instrument's domain **is**
the symptom's visibility surface. ⇒ **Isolating the condition under which a symptom APPEARS feels like
root-causing and is not.** The occurrence table answers "when can I see it", never "where is it made".

⇒ ✅ **Operable check, cheap: at every level your first instrument called CLEAN, run a second instrument
whose domain is upstream of the symptom.** Here: a validator, not a grep of the output. If the second
instrument fires on the "clean" rows, the first one measured visibility and the gate you published is
the wrong gate.

⭐⭐ **Corollary — the level that "fixes" it is evidence about the repair path, not the defect.** Default
`-g` looked correct because the malformed def-use edge exists only in debug-info insts and none are
emitted; the designed repair (`fixValueScoping`, `slang-ir-restructure-scoping.cpp:198`) moves an `IRVar`
but has **0** occurrences of `DebugVar`, and `applyVariableScopeCorrection`
(`slang-ir-variable-scope-correction.cpp:281`) switches on type ops only. A pass being *blind* to a shape
looks identical, from the output, to the shape being *absent*.

⚠️ **Provenance discipline this instance also exercised.** The refined mechanism came from the verifying
tier, not from me, and the tier explicitly refuted a *plausible* competing story its own subagent had
proposed ("hoisting leaves a dangling DebugVar" — wrong; the real mechanism is that `fixValueScoping`
never *sees* a DebugVar def, and that story also missed the second blind pass entirely). ⇒ **Do not
republish a refuted mechanism because it is easier to narrate.** Cf.
[[feedback_mechanism_must_predict_observed_coordinates]].

⛔ **Instrument defect worth its own line: a compile probe with no `.cpp` extension returned rc 0 on BOTH
arms** — clang never parsed the body, so the A/B read as "no bug". A void probe fails toward the answer
that closes the investigation. Renaming made it real (`-g2` ⇒ exit 1, exactly 1
`use of undeclared identifier`; default ⇒ exit 0, 0 errors).

⚠️ **Scope, again: the verifying tier reported "no session on #12462" as a flat fact.** True of its own
group — its `cli_scope` is `group`, so it cannot see mine. On my `global` scope a Main session on that
thread exists. Same shape as [[feedback_a_shared_bot_identity_makes_duplicate_posts_invisible]]'s
421-vs-2297 reconciliation: **a session-population claim is scope-relative and both parties can be right.**

Related: [[feedback_issue_opened_webhook_is_not_evidence_the_issue_is_new]] (the same batch's routing
lesson — a bot-filed body IS the triage), [[project_12461_switch_case_decl_later_case_g2_undeclared]],
[[feedback_a_control_validates_the_instrument_never_the_target]].
