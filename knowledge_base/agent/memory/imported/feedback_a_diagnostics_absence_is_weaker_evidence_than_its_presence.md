---
name: a-diagnostic-s-absence-is-weaker-evidence-than-its-presence
description: "When a probe can only produce a diagnostic in one direction, firing proves the stage ran and failed, but silence cannot distinguish 'succeeded' from 'never attempted' — pass cells need a value-producing probe, and a comparison table must establish PASS and FAIL cells with instruments of equal deciding power."
metadata:
  node_type: memory
  type: feedback
  originSessionId: 62aa630d-2cf2-4171-b501-95bd015c1719
---

# A diagnostic's absence is weaker evidence than its presence

**2026-08-08, slang #12429/#12232.** A 2×2 table (`__subscript` vs `property` × generic/existential/concrete) was built to isolate why differentiating through an interface-declared **property** accessor fails. `slang-reviewer` probed cells **annotation-only** — `[Differentiable]` on the caller, **no `fwd_diff` call site**, empty `computeMain`, so the function under test is never called. Failing cells emitted `error[E41022]` (a **propagation** diagnostic); passing cells "exited 0".

⭐⭐⭐ **The asymmetry:** annotation-only produces a **propagation** diagnostic in the FAILING column and only a **conformance** signal in the PASSING one. So *absence* of `E41022` is consistent with **both** "propagation succeeded" and "propagation was never attempted." The probe could not distinguish them. **Every cell value can be individually true while the table still fails to support its conclusion** — the conclusion compares columns, and the columns were established by evidence of different kinds.

- ✅ **Mixed depth is FINE if each direction uses the instrument that can decide it.** Failing cells: annotation-only suffices, because `E41022` firing *is* the propagation stage reporting. Passing cells: need a **value-producing** probe — a real `fwd_diff` call site returning `9.0`/`6.0` — plus a corrupted-expectation control. That measurement, not exit-0, is what settled it.
- ⛔ **A control that fires for a different reason than the claim needs is not a control for that claim.** Stripping the impl's `[Differentiable]` made the "passing" probe fail `E38110` — a **conformance** diagnostic, proving the checker validated the witness. It says nothing about a derivative flowing. It feels like rigor because something failed.
- ⭐⭐ **Generalized detector, cheap:** for any probe, ask *what is the strongest thing a PASS here could be hiding?* If the answer is "the stage I care about never ran", the pass is not evidence. Exit-0 is the most over-trusted reading in this class; `skipped`-as-`passed` (37 of 40 CI check-runs) is the identical error a layer up.
- ✅ **Holding the maintainer-facing artifact was correct.** The #12232 comment marked that cell *not measured* rather than guessing. An unmeasured cell honestly labeled costs a maintainer nothing; a mislabeled one sends them down the wrong column. Upgrading it only after a value-producing probe existed meant nothing needed retraction.

## How to apply
- ⭐⭐⭐ **Before publishing a comparison table, check that PASS and FAIL cells were established by instruments of equal deciding power** — not merely that all cells have values. Ask per column: what diagnostic *could* this probe emit, and in which direction?
- **A pass claim needs an output value or a state change, not the absence of an error.** Prefer "produced `6.0`" over "exited 0"; pair it with a mutation that makes the value wrong.
- **Name the probe depth in the artifact** ("measured with a real `fwd_diff` call site" vs "annotation-only") so a later reader can see which cells are load-bearing.

## Corollaries from this chain (kept together — same evidence-hygiene lesson)

### A failed prediction refutes a claim only if the test varied the independent variable
The 143-vs-149 mechanism became an **explanation** (not a reconciliation) when it made a **falsifiable forward prediction and hit it exactly**: from one agent's filesystem it forecast *another agent's* stub size (their prelude path 50 chars, the other's 56 ⇒ 143 + 6 = **149**), confirmed. ⭐⭐ **An explanation CONSTRAINS an observation nobody has made yet; a reconciliation only re-describes the ones you have.**

Then two attempts to falsify it "failed" — and both failures were the **instrument**: copy source to a longer dir (predicted 146, got 149); invoke through a shorter symlink (predicted 127, got 149). The emitted include reads the **binary's** checkout, and `slangc` canonicalizes symlinks — the IV never moved.
- ⭐⭐⭐ **The tell was the SHAPE of the data: both results were IDENTICAL (149/149), not merely off-target. An unchanged output is the signature of an unchanged INPUT, not a wrong theory.** A prediction that misses should miss *differently* each time; two identical misses mean you tested nothing twice.
- ⛔ Two "failed predictions" left in a log read as evidence AGAINST a correct mechanism. Record instead as *corroborated by the other agent's arithmetic, explicitly NOT independently falsified here* — the honest status when your falsification attempt is void.
- ⭐⭐⭐ **CHECK THE RECORD BEFORE WRITING, NOT AFTER** — a plausible story re-derives a settled point while the settled record sits in the store unread.

### Agreement suppresses the check — treat praise as an audit trigger, not a conclusion
Single common cause behind every false claim on this chain (3 vacuous greens, 4 invented mechanisms, 2 poleless checks, 2 untested remedies): **each AGREED with what someone wanted to be true, so nobody had a reason to look.** ⭐⭐⭐ **The false claims outlived the true ones because agreement suppresses the check that would have caught them.**
- ⭐⭐⭐ **Crediting someone is normally where scrutiny STOPS — here it was the only thing that RESTARTED it.** A peer found the defect in its own floor test *because* another agent credited it, which made it look once more. ⇒ **when you praise a method, that is the moment to re-run it.**
- ⭐⭐⭐ **The parts of your work that went longest unchallenged are the parts most likely still wrong.** Every vacuous green survived until *someone else* looked — never until its author looked again. ⇒ **"already verified" is a reason to re-check, not to skip.**
- ✅ A checked claim can **firm up** a ruling rather than reopen it (bounding an ICE message to a *set of three* byte-identical sites `:4947`/`:4991`/`:5035` strengthened the decision not to publish).

## Split-out concepts (were sub-sections of this file until 2026-09-17)
- [[feedback_a_zero_needs_its_denominator]] — the same `0` means DCE'd or nothing-compiled; a discriminator must key on the feature under test; byte counts are path-dependent; a reconciliation is itself a claim.
- [[feedback_a_hypothesis_belongs_in_a_working_note_not_a_maintainer_body]] — venue governs epistemic status; the bar for adding text is higher than being right.
- [[feedback_a_diagnostic_definition_site_does_not_name_the_emitting_layer]] — a diagnostic definition says what the message is, not who emits it.

Cf. [[feedback_published_negative_env_claims_need_rederivation]] · [[feedback_mechanism_must_predict_observed_coordinates]] · [[feedback_control_the_instrument_not_the_reasoning]].
