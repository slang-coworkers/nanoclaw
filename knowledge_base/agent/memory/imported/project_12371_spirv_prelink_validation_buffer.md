---
name: project_12371_spirv_prelink_validation_buffer
title: slang#12371 — SPIR-V validation reads the pre-link buffer
description: "slang#12371: SPIR-V validation ran on the PRE-LINK buffer (`compiler->validate(spirv.getBuffer())` in slang-emit.cpp) so a valid LINKED module was rejected for OpCapability Linkage. Root cause + fix constraints for the fixer, dispatched as draft PR (A1: validate the linked bytes). Durable lessons: a diff hunk header is not a line delta; a state latch keyed only on remote state is blind to a never-created CI; an escalation ceiling is a LAP not an exit; a figure in a Status bullet inherits the credibility of the verified numbers beside it."
metadata:
  node_type: memory
  type: project
  originSessionId: 3f8c803c-bb49-4678-a7c5-abc649c949c0
---

# slang#12371 — SPIR-V validation reads the pre-link buffer

**Terminal / historical (dispatched-as-draft).** Distilled 2026-08-31 from a 150 KB
wake-by-wake chronicle (~15 supervisor wakes, 08-06 → 08-11). The dated wake narrative
and the live falcor-lap / escalation-window telemetry are pruned; what remains is the
defect, the fix constraints handed to the fixer, and the durable reasoning lessons.

## The defect (at merged master `9cd92bb3a`, `source/slang/slang-emit.cpp`)

- `if (needsLink)` block: builds `linkedArtifact`, then `artifact = _Move(linkedArtifact)`,
  block closes.
- Immediately after, `if (needsValidation)` calls
  `compiler->validate((uint32_t*)spirv.getBuffer(), …)` — **the PRE-LINK buffer.** A valid
  *linked* module is rejected for `OpCapability Linkage` (5 Import / 0 Export) that only
  exists in the pre-link form. **This is the bug.**
- Control for "am I validating the right bytes": generator word `0x00110000` = tool 17
  (SPIR-V Tools Linker) is present in linked output, absent pre-link.

⭐ **A sibling PR #12353 merged and REWROTE the same block but KEPT `spirv.getBuffer()`** —
the textual collision is gone, the defect untouched. Confirmed by reading the line at the
merge commit; do NOT infer "the rewrite probably fixed it" from the fact it rewrote the
block.

## Fix shape dispatched to the fixer (A1: validate the linked bytes)

1. ⛔ **"Validate `linkedArtifact` after the move" does NOT compile** — moved-from, and
   scoped to the `if (needsLink)` block. Workable: hoist the blob out of the branch, move
   validation inside the branch, or re-load from `artifact` (in scope; holds the linked
   result when `needsLink`, fresh bytes otherwise).
2. **Regression assertion = dropping the `-skip-spirv-validation` skips**, not a new test:
   `tests/library/precompiled-spirv-generics.slang:10` and
   `precompiled-spirv-pointer-param.slang:11` still carry it at master.
3. ⛔ **Dropping the flag ALONE is a vacuous assertion.** `shouldRunSPIRVValidation` is a
   three-way gate defaulting `false`; its third arm needs `SLANG_RUN_SPIRV_VALIDATION==1`,
   which `slang-test` does **not** set (CI does). So the test passes identically with and
   without A1 locally. Fixer's shape: **layer-1 unit test with its own `ScopedEnvVar`**
   (precedent `unit-test-spirv-validation-unavailable.cpp`) **+ layer-2 flag drops for CI**;
   both must FAIL on unpatched master with env=1 first.
4. **Keep an explicit `return SLANG_FAIL`** on validation failure — the abort is
   severity-driven and severity is overridable (`getEffectiveMessageSeverity` can demote,
   `Severity::Disable` returns before any abort). #12353's author added exactly this with
   *"whether a rejected module reaches the caller must not depend on the diagnostic's
   severity."*
5. **Do NOT touch `precompiled-glsl.slang`** — `needsLink` is false there
   (`isPrecompilation`), so its `Linkage`/`Export` is legitimate.
6. **Do NOT bundle** the bare `return SLANG_FAIL` arm — #12359 already diagnoses it.
7. `extras/formatting.sh` cannot run in the triager container (gersemi/clang-format/
   prettier/shfmt absent) — the PR author runs it.

**Disposition:** dispatched on the task's stated default (A1 only, branched on merged
master, `pr: non-breaking`, `Fixes #12371`, held as **draft**) after the A1-vs-A2 and
stack-vs-master questions to `orchestrator-dashboard` went unanswered. ⚠️
`ask_user_question` is **swallowed** from guard sessions (`messaging_group_id` is null) —
use `send_message(to:"orchestrator-dashboard")`; see
[[feedback_a_gate_on_someone_elses_reply_needs_its_own_resume_path]]. Follow-up sweep for
the #12342 downstream-absent-capability issue tracked in
[[project_12342_downstream_absent_capability_slangresult]].

## Durable reasoning lessons (earned across the wakes)

- ⭐⭐⭐ **A state latch keyed exclusively on REMOTE state is blind to a never-created
  local one.** For ~10 wakes the latch reported "unchanged" while the truth was that **no
  CI run/check-suite/workflow was ever created** for the PR — the surface being read
  cannot contain the fact being sought. Read the surface that CAN hold the answer.
- ⭐⭐⭐ **A figure in a `**Status:**` bullet inside a list of verified numbers inherits
  their credibility** — a fabricated figure rode ~8 wakes of deliberate re-measurement
  because it sat among true numbers and never registered as a claim to re-check. Every
  figure needs its own witness, not the credibility of its neighbours.
- ⭐⭐ **A diff hunk header is not a line delta.** `@@ -3428,11 +3428,26 @@` means start-line
  unchanged; only lines *below* move. A published "+1 shift" was bogus.
  See [[feedback_a_diff_hunk_header_is_not_a_line_delta]].
- ⭐⭐ **An escalation ceiling is a LAP, not an exit.** The 12 h ceiling only pays out if a
  run actually re-fires and re-evaluates the gate at a larger age; three consecutive
  published escalation windows on this chain **closed unused** (the run was attempt-1,
  `conclusion=failure`, never re-run). See
  [[feedback_a_cap_that_is_slack_at_rest_binds_when_the_state_changes]].
- ⭐⭐ **After pinning a blocking condition, enumerate every transition that could clear
  it** before recording it "unreachable" — wake #11's "unreachable without a human" was
  falsified by our own push 3.5 h later. See [[feedback_a_risk_does_not_license_a_mechanism]].
- ⭐⭐ **A skip is an untested HYPOTHESIS about the failure** and only fires when the thing
  it guesses is true; "74 skipped" is the ABSENCE of a measurement, never a weaker green.
  A latch its own failure path can write is not a latch —
  [[feedback_a_latch_its_own_failure_path_can_write_is_not_a_latch]].

## Related concepts

- [[feedback_a_gate_on_someone_elses_reply_needs_its_own_resume_path]]
- [[feedback_a_diff_hunk_header_is_not_a_line_delta]]
- [[feedback_a_cap_that_is_slack_at_rest_binds_when_the_state_changes]]
- [[feedback_a_latch_its_own_failure_path_can_write_is_not_a_latch]]
- [[feedback_a_risk_does_not_license_a_mechanism]]
- [[feedback_zero_output_is_not_available_scratchpad_still_delivers]]
- [[project_12342_downstream_absent_capability_slangresult]]
