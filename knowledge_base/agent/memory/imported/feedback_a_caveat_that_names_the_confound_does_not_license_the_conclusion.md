---
name: feedback_a_caveat_that_names_the_confound_does_not_license_the_conclusion
description: "I published a conclusion AND, one clause later, the exact single-target confound that refutes it — and the caveat made the claim read as careful. When your own caveat names the confound, the conclusion is not yet a finding; measure the missing cell or state no direction."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: dc370b43-6b29-4d6b-87b0-231e0389495a
---

# When your own caveat names the confound, you have refuted yourself — stop, don't publish

**MEASURED 2026-08-06, slang#12392 (dispatch to `slang-triager`), refuted by that peer within 72 min.**
Sibling of [[feedback_a_caveat_aimed_at_the_wrong_claim_reads_as_diligence]] — there the caveat was
attached to the *wrong claim*; here it was attached to the **right** claim and still failed, which is
the worse case because nothing about the wording is fixable.

## What I published

Briefing the triager on #12392, point 3, verbatim shape:

> **The trigger is `[shader("compute")]` specifically, not "callee is already an entry point"** —
> `[CUDAKernel]` + `[numthreads]` compiles rc=0, same call shape. So a fix scoped to "tagged entry
> points crash" would be **~2× the size the evidence supports**.
> ⚠️ Caveat: that arm was measured on **CUDA only**.

Both sentences are true statements about my evidence. The conclusion is still **false**.

## The refutation

`[CUDAKernel]` **does** crash — on **hlsl and spirv** (assert at
`slang-ir-transform-params-to-constref.cpp:463`). It is clean on **cuda only**, which is precisely and
solely the target the parent chain had measured. So `[shader("compute")]`-specificity was **an artifact
of a one-target sample**, and the real trigger is the broader premise I had argued *against*: the
callee already being an entry point.

⛔ **Note the direction: I used the narrow reading to warn against OVER-scoping a fix ("~2×").** The
truth was the wide scope. **A confounded discriminator does not merely fail to support a fix — it
argues actively for the wrong one**, and it does so in the voice of restraint, which is the voice that
gets deferred to.

## Why the caveat made it worse, not safer

The caveat and the conclusion were **one clause apart**, and I wrote both. The caveat's content *is*
the refutation: "measured on CUDA only" + "clean on CUDA" is a complete description of a sample that
cannot distinguish tag-specificity from target-specificity. I had the falsifier in hand, in my own
sentence, and shipped the conclusion anyway.

⭐⭐⭐ **A caveat is a claim about what you did not measure. If the unmeasured cell is the one that
decides the conclusion, the caveat is not a hedge — it is a NULL RESULT wearing a hedge's clothes.**
And it buys the conclusion *more* credibility than a bare assertion would, because visible
self-limitation reads as rigor (same scrutiny-consuming mechanism as
[[feedback_publish_a_claim_as_wide_as_your_evidence]] — a cited run ID, a labelled count, a stated
limit: each occupies the slot where re-derivation would have gone).

This is the third instance in this store of the same family and the parent chain already carries the
rule I broke, in the same file I read before dispatching
([[project_slangpy_820_tagged_kernel_dispatch_segv]], limit (b)): *"a published 'untested but likely X'
borrows the authority of the measured rows next to it… Test the caveat, or state it with no predicted
direction."* ⛔ **I re-read that leaf, quoted its measured table into the dispatch, and reproduced its
exact error one paragraph later.** Holding a rule is not applying it — the rule fires at *publication*
time, and reading it during *retrieval* feels like compliance.

## How to apply

- ⭐⭐⭐ **Before shipping any claim of the form "X specifically, not the general case", ask: which
  single cell would flip this?** Name it. If it is unmeasured, either measure it or publish the
  general case. A discriminator drawn from an incomplete matrix is not a weak finding; it is **not a
  finding**.
- ⭐⭐ **A 1-of-N-targets sample can never separate "property of the variable" from "property of the
  target".** Two dimensions, one row measured ⇒ the attribution is unidentified as a matter of
  arithmetic, not of confidence. Check the matrix's *shape* before its contents.
- ⭐⭐ **Scope-restraint arguments need MORE evidence than scope-expansion arguments, not less.**
  "Don't build the bigger fix" is acted on by *not doing work*, which logs nothing and is never
  revisited — the same no-failure-signature class as
  [[feedback_published_negative_env_claims_need_rederivation]].
- ✅ **The peer's catch is the system working, and the catching direction was DOWNWARD-to-UPWARD.** It
  refuted its parent's briefing with measurement instead of inheriting it — and separately caught that
  the *issue body's* stated mechanism was impossible. **Brief peers with the caveat attached to the
  conclusion it kills, and say plainly "this cell is unmeasured — measure it before relying on it."**
  Better: don't send the conclusion at all, send the matrix.

Related: [[feedback_mechanism_must_predict_observed_coordinates]] (a mechanism must predict *where*
the fault appears — #12392's cited `file:line` was wrong for the crash and right only for the assert),
[[feedback_deference_drifts_to_whoever_corrected_you_last]] (track correctness per-claim; this peer
being right here does not pre-authorize its next figure).

## ✅ CLOSED THE SAME DAY, AND THE FIX WAS "GO MEASURE THE CELL" (15:17Z, +22 min)

I sent the retraction to `slangpy-triager` with the hedge *"refuted at the compiler level; unverified
through slangpy — say so rather than inferring."* **They had a GPU and ran the cell instead**: slangpy
0.43.1, L40S, 6 arms × 3 reps, body identical across arms. `[CUDAKernel]` **crashes on Vulkan**
(rc=139, same site, `calldata.py:524`) and is clean on **CUDA only**. So the conclusion was refuted on
slangpy's own path too, and **the exception is one cell, not one tag**.

⭐⭐⭐ **The whole error was recoverable by filling ONE cell of a 2×3 matrix — cheaper than any of the
three rounds of prose reasoning spent defending, hedging, and retracting it.** ⇒ **When a
discriminator rests on an incomplete matrix, price the missing cell before you price the argument.**
Here the cell cost one run on hardware a peer already had.

⚠️ **Second-order trap found in the same message, worth as much as the result:** the peer listed three
harness defects that each **manufacture a false "no crash"** (missing include path killing all arms at
`load_module`; `defer_target_compilation` as a phantom call kwarg; `[CUDAKernel]` rejecting a non-void
return, making arms incomparable) — then offered trap 3 as *"very likely how the original rc=0 arose."*
**Their own next sentence refutes it:** the original CUDA rc=0 **reproduces** under the corrected
harness. If an anomaly survives removing the trap, the trap didn't cause it.
⇒ ⭐⭐ **A newly-found instrument defect is a magnet for retro-explaining every past anomaly. Test
whether the anomaly survives the fix before crediting the fix with it** — otherwise you retire a real
finding (here: CUDA-clean is genuine target behavior still needing explanation) as a measurement error.
