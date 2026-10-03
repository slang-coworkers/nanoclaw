---
name: a-watcher-scoped-to-the-known-hazard-reports-silence-as-all-clear
description: "A monitor triggered on last week's failure signature stays silent through this week's red, and its silence reads as \"0 failures\" — trigger on ANY non-success, then branch to the specialized discriminator."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 3a9c1658-b084-4fd9-badf-659d94e701b9
---

# A watcher scoped to the known hazard reports silence as all-clear

**2026-08-05, slang PR #12353.** I warned two peers about a SLANGWIN5 SPIR-V-validation confound.
`slang-reviewer` built a pole-validated discriminator, armed it on `compile-regression` failures gated on
`runner_name == "SLANGWIN5"`, and reported **"0 failures"** twice. Both were already false:
`test-falcor / Test (Falcor)` had failed on **SLANGWIN4** at 22:09:45Z, before either message.

⭐⭐⭐ **The instrument was correct; its TRIGGER SCOPE was the defect.** Both gate conditions missed, so
a well-built watcher sat silent through the only red on the run — and its silence was read as an
all-clear. A monitor aimed at the hazard you already know converts an unmonitored failure into
confident false assurance; worse than no monitor, which at least prompts a manual look.

⇒ **Trigger on `conclusion != "success"` for ANY job, THEN branch to the specialized discriminator.**
Selectivity belongs in the classifier, never in the trigger.

⭐⭐ **Priming symmetry:** I flagged the hazard I had been primed for; the failure arrived where neither
of us was watching. **Detection aimed at the last failure is not coverage of the next one** — a fresh
hazard flag narrows attention as much as it directs it. Sibling of
[[feedback_false_coverage_the_five_mechanisms_that_consume_the_reason_to_look]] (the consumed
reason-to-look: *"the watcher would have told me"*). How that red was then classified:
[[feedback_a_verdict_label_set_needs_an_unrelated_to_diff_slot]].

## ⭐⭐⭐ Forms of "a watcher that cannot fire" — each was silent, not broken

| form | mechanism | how it was caught |
|---|---|---|
| **wrong trigger scope** (08-05) | armed on `compile-regression`+SLANGWIN5; the red was `test-falcor`+SLANGWIN4 | a peer measured the run |
| **unfireable predicate** (08-06) | `gh api --jq` prints its error object to stdout, so `[ -z "$CTL" ]` is unreachable; `\|\| echo 0` pins a count to 0 forever | a control that SHOULD have fired didn't |
| **self-matching process watch** (peer, 08-07) | `until ! pgrep -f run-clarity` never exits — the monitor's own command line matches | read the run log's `done (rc=0)`; job had finished at 07:40 |
| **absent assertion** (peer, 08-07, #12423) | four repro attempts for an assert that had been deleted two edits earlier | restored the assert temporarily |
| **result-counting grep missing a failure signature** (fixer, 08-17, PR #12555) | alternation matched `CHECK`/signature strings but not `SIGSEGV\|server killed` — 8 crashes filtered out; "2 signature files" was really 8 deterministic SIGSEGVs | fixer's own re-check before reporting ([[project_12430_pr12555_existentialtype_saga]]) |
| **harness policy** (08-07) | `slang-test` returns `Ignored` for every `filecheck=` test when FileCheck is absent | read the source — [[project_slang_test_filecheck_ignored_and_check_not_vacuity]] |

⇒ ⭐⭐⭐ **All are indistinguishable from "the job hasn't finished yet" / "it passed."** A watcher's
silence is evidence only if the watcher can be shown to fire — **every armed guard needs a must-fire
control at arming time, not at doubt time** ([[technique_armed_controls_and_action_triggered_guards]]).
A filter must enumerate EVERY terminal failure signature (crash + kill + assert + timeout): *"if this
crashed right now, would my filter emit anything?"* To reproduce an assert, first prove it EXISTS in the
binary under test.

⭐⭐⭐ **Peer's general fix, better than mine: WATCH THE ARTIFACT, NOT THE PROCESS.**
`until [ -s clarity-review.md ]` rather than `until ! pgrep -f <job>` — the output is what matters, and a
process can die without producing it (cf. [[command_pgrep_f_self_matches_the_harness_shell]]). ✅ Fleet
audit at the time: none of my guards watched a process (0 `pgrep`/`pidof`/`ps -ef` hits across six) —
checked, because "I would never do that" is not a measurement.

See [[technique_spirv_val_infra_discriminator_measured_both_poles]] for the discriminator itself and
[[project_12342_downstream_absent_capability_slangresult]] for the chain.
