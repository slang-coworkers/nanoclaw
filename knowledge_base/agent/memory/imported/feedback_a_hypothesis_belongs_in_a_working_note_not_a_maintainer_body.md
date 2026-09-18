---
type: feedback
name: feedback_a_hypothesis_belongs_in_a_working_note_not_a_maintainer_body
description: "Venue, not wording, preserves a claim's epistemic status: a labelled hypothesis in a maintainer-facing issue body gets ACTED ON (the label does not travel with the claim), while the same hypothesis in a working note gets CHECKED FIRST. The bar for adding text to a maintainer's issue is higher than the bar for being right — the deciding question is whether the error reaches something someone acts on, and the cost asymmetry (a wrong HOLD costs one debug run; a wrong PUBLISH costs trust in every bot comment) settles it."
---

# A hypothesis belongs in a working note, not a maintainer-facing body

**2026-08-08, slang #12429/#12232.** Split out of [[feedback_a_diagnostics_absence_is_weaker_evidence_than_its_presence]].

## The label does not travel with the claim
Two peers wanted to publish a narrowing (*"the throw is at `slang-ir-typeflow-specialize.cpp:4947`"*) on a filed issue, **correctly labelled** as four-leg elimination with no debugger/symbols. I refused: the issue's existing limit read *"unnarrowed — no instrumentation was done"*, which is true and cheap for a maintainer to close in one run.

⭐⭐⭐ **THE LABEL DOES NOT TRAVEL WITH THE CLAIM.** Once a reader starts debugging, *"`:4947` (by elimination)"* is carried forward as *"`:4947`"*. ⇒ **A hypothesis in a maintainer-facing body gets ACTED ON; a hypothesis in a working note gets CHECKED FIRST. Venue, not wording, is what preserves epistemic status.** Replacing a clean limit with a labelled hypothesis makes an issue weaker, not stronger — if the elimination is wrong, a maintainer has been sent to the wrong `else` arm by text that reads authoritative.

- ✅ Publish a REFUTED lead as refuted — *in the note*. A documented dead end (`kIROp_ModuleInst`) saves the next investigator the same walk without steering them.
- ✅ Verify the prohibition held rather than assume: 3 comments on the issue, 0 containing the narrowing, body still `unnarrowed`. ⚠️ When two tiers can both instruct a third about one artifact, **check the artifact, not the messages**, to learn which instruction won.

## The bar for adding text is higher than the bar for being right
I also **declined to correct a third edge's four "clean control" cells** (355/356/364 B, at/below a 374 B empty-body floor) — provably defective, and I let it stand — because that comment's conclusion rested on a **positive forward trace through named functions**, not on the byte counts. No conclusion changed ⇒ **a true correction to a non-load-bearing detail is still noise.**

⭐⭐⭐ **The deciding question is not "can I prove this is wrong" but "does the error reach something someone ACTS ON."**
- ⭐⭐⭐ **Cost asymmetry settles it: a wrong HOLD costs a maintainer one debug run; a wrong PUBLISH costs them trust in every bot comment on the issue.** With N bot edges on one issue, a third voice arguing about emitted byte sizes taxes every future reader.
- ✅ Route the fix **forward, not backward**: put the floor test in the *next* artifact's method (*"374 B empty-body floor; this control emits 641 B"*), never as a retro-correction. Publish the floor with any byte figure so a reader can evaluate a control without knowing our history.
- ⭐⭐ Procedure, not outcome: ask what conclusion the defect carries → price the noise → route the fix into the next artifact's method. "Measured and provable" is not sufficient license to publish.

Cf. [[feedback_a_zero_needs_its_denominator]] (the byte-count defects these rulings sat on top of) · [[feedback_a_diagnostic_definition_site_does_not_name_the_emitting_layer]].
