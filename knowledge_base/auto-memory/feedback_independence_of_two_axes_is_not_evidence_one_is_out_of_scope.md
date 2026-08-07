---
name: feedback_independence_of_two_axes_is_not_evidence_one_is_out_of_scope
description: "Proving requirement B is INDEPENDENT of A licenses only 'A can ship first' — never 'B is off the critical path'. Scope comes from the ASK; independence is a sequencing fact. Measured on slang#12411; caught by critique, not by the measurement."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: dd6c5348-62db-4101-8b01-d603c9d1d751
---

# Independence is a sequencing fact, not a scope reduction

**A decomposition finding answers "what order can these ship in?" It does NOT answer "what did the
requester ask for?"** Those are different questions with different sources of truth — the first is
measured from the code, the second is read from the request.

## The instance (slang#12411, 2026-08-06)

An issue named three blockers for BFloat16 in cooperative vectors. Measurement proved they sit on
two independent axes: `CoopVecComponentType` values are *interpretation* operands (lowered as
constants) while `CoopVec<T,N>`'s `T` is the *register* element type, and nothing constrains them to
agree. The decisive cell: `coopVecMatMul(..., ::Float16, ..., ::FloatE4M3, ...)` compiles and emits
`ComponentType::F8_E4M3` while `CoopVec<FloatE4M3,4>` is rejected `E38029`.

The measurement was **correct**. The draft conclusion — *"blocker 2 is not on the critical path"* —
was **wrong**, and would have silently dropped part of the requested surface: `coopVecLoad<let N,
T : __BuiltinArithmeticType>(buffer, offset)` takes **no interpretation parameter**, so the bound
alone gates it, and the issue names it explicitly.

⭐⭐⭐ **The error was invisible to more measurement.** Every additional probe on the interpretation
axis would have kept confirming independence — the true premise. The false step was the inference
*from* it, and the only thing that catches that is re-reading the ask. An adversarial critique
round caught it; the measurement never could.

## Why this generalizes

A decomposition finding is inherently *attractive*: it makes a large task look small, it comes with
receipts, and it arrives at exactly the moment you want scope to shrink. That combination —
correct evidence pointing at a convenient conclusion — is the shape to distrust.

## How to apply

⛔ **Before publishing any "X is separable / not blocking / out of scope" claim, re-read the
original request and enumerate the surfaces it names. Then check each one against the axis you just
carved off.** Independence earns *"A can land as a first PR"*; it never earns *"B is optional"*.

Write it as two sentences, not one: what can ship first, **and** what remains required. The
sentence that omits the second half is the failure.

Corollary — **a fix applied to a flagged sentence does not fix the claim's other occurrences.** In
this same episode, round 2 of critique found the flagged sentence corrected while a downstream
"Approaches" section still carried the superseded claim. When you retract a conclusion, grep the
document for it. See [[feedback_deference_drifts_to_whoever_corrected_you_last]] on the same theme:
fixing a diagnosis does not fix figures derived from it.

Related: [[project_12411_coopvec_bfloat16]].
</content>
