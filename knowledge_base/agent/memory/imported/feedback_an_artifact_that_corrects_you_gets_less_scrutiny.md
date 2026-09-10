---
name: feedback_an_artifact_that_corrects_you_gets_less_scrutiny
description: "Finding an external artifact that corrects you feels like the win, so it inherits authority and skips review — a peer quoted its 'unreachable by the user' claim approvingly one paragraph after its own measurement refuted it. Vetting scales with SOURCE, not with correctness."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: dd6c5348-62db-4101-8b01-d603c9d1d751
---

# An artifact that corrects you gets less scrutiny than one you authored

**The vetting you apply to a claim tracks where it came from, not how likely it is to be wrong.** A
claim you authored gets challenged. A claim from an external artifact that just corrected you gets
quoted — because *finding it* was the win, and after a run of your own claims being corrected, an
outside source feels like solid ground.

⭐⭐⭐ **This is the aperture failure with the polarity flipped.** The usual case is over-trusting your
own frame; this is over-trusting the thing that broke it. Same mechanism — an authority chosen up
front, then reasoned inside.

## The instance (slang#12411 → PR#10711, 2026-08-06)

A peer's dedup, run with a corrected aperture, surfaced a pre-merge review comment that had predicted
a crash and been dropped. Real find. It then **quoted that comment's claim — the diagnostic is
"unreachable by the user" — approvingly in a public verdict, in the same paragraph as its own
measurement showing both `E55208` and `E99997`.** Its measurement was right; the artifact was
overstated; the contradiction was two sentences apart and survived publication.

Three further defects turned up in that same 5-line comment once it was actually reviewed:

1. **Overstated severity** — "unreachable" vs. measured diagnostic-then-abort.
2. **Non-transplantable code** — its `return;` precedent is real (`emit-hlsl.cpp:1579-1585`) but
   returns `true` from `bool tryEmitInstExprImpl` (`:1133`), while the crash site is in `void
   emitSimpleTypeImpl` (`:1832`); and its three helper calls interleave with their asserts, so a
   combined guard needs them hoisted.
3. **Overreach** — it put `matrixUse` in the proposed null-guard, but `getCoopMatMatrixUseName`
   **cannot** return null: its signature takes no `DiagnosticSink` (`slang-emit-hlsl.h:170`), so it
   `SLANG_UNEXPECTED`s instead. Two of three helpers qualify, not three.

⇒ **A correct finding and a correct remedy are independent.** This comment identified a real bug
(finding: right) and proposed a fix that needs three corrections before use (remedy: wrong). Adopting
it wholesale — the peer's draft said "reuse rather than re-derive" — would have shipped all three.

## How to apply

⛔ **When an external artifact corrects you, review it exactly as you'd review your own draft — and
do it at the moment of adoption, not later.** Concretely:

- **Diff its claims against your own measurements.** If you measured the same phenomenon, say which
  one is authoritative and why. A quoted claim adjacent to your contradicting figure is the tell.
- **Compile its code mentally against the actual site.** Return type, control flow, call ordering,
  and whether each guarded value *can* take the guarded state.
- **Separate "the finding is real" from "the fix is right."** State the verdict on each.

⭐⭐ **Vetting must scale with stakes, not with source.** "It corrected me, so it's probably right
about the rest" is the inference to kill — being right about A is no evidence about B, especially in a
5-line comment written under review-time pressure.

⚠️ Also from this episode: **find precedents by STRUCTURE, not by quoted words.** Grepping the review
comment's paraphrase of the precedent's comment text returned nothing, though the precedent was 400
lines away. Same aperture lesson, inverted — searching the citation's words instead of its shape.
See [[feedback_in_body_qualifier_silently_excludes_every_comment]].

Related: [[feedback_a_working_fix_does_not_confirm_the_cause_you_credit]] (the two-variable twin),
[[feedback_deference_drifts_to_whoever_corrected_you_last]] (the per-agent version of this — a
corrector who was right 4× does not make its next figure authority),
[[project_12411_coopvec_bfloat16]].
</content>
