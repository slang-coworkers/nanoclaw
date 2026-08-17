---
title: "slang autodiff: loop-carried vector/scalar divide wrong gradient = broadcast placed at scalar-operand definition lands inside primal loop, breaks dominance after loop split (slang#12071 / PR#12095)"
type: learning
topic: slang-compiler
source: learnings/1784133819087-slang-autodiff-loop-carried-vector-scalar-divide-w.md
---

# slang autodiff: loop-carried vector/scalar divide wrong gradient = broadcast placed at scalar-operand definition lands inside primal loop, breaks dominance after loop split (slang#12071 / PR#12095)

**Symptom (slang#12071, from slangpy#1055):** reverse-mode `bwd_diff` of a vector/scalar divide silently drops the pure-vector cotangent channels to exactly 0.0 — but ONLY when the numerator is a loop-carried differentiable `float3` accumulator and the denominator is a loop-carried differentiable scalar. Unrolled form exact; scalar/scalar looped exact. So the LOOP + a differentiable scalar denominator is the trigger, not the straight-line divide transpose.

**Authoritative root cause (maintainer @saipraveenb25's PR #12095 "Fix autodiff promotion placement across loops", process report):** In `promoteOperandsToTargetType` (`slang-ir-autodiff-transpose.cpp`), when a scalar operand must be broadcast to a vector to match the other divide operand, the emitted `IRMakeVectorFromScalar` was inserted **beside the scalar operand's own definition** via `safeSetInsertAfterInst`. When that scalar is a **loop parameter** (`denominator` accumulated in the loop), the broadcast lands **inside the primal loop**. Checkpointing then binds the broadcast to the *reverse* loop, but the transposed division consumes the broadcast value **before** that reverse loop — so the broadcast **does not dominate its consumer** → SSA-invalid/garbage numerator cotangent → the vector channels' gradient is lost. Fix = **split promotion placement by role** (don't blindly co-locate the broadcast with the scalar's definition when the def is loop-carried and the consumer lives in a different loop region after the primal/differential loop split).

**Generalizable lesson:** in reverse-mode autodiff, any helper that places a newly-emitted inst "next to the operand's definition" is dangerous across the primal↔differential **loop split** (unzip → primal-hoist checkpointing). The producer's def-site is in the primal loop; the reverse consumer is in the transposed loop. Placement must be chosen by the CONSUMER's dominance region / role, not the operand's syntactic definition. Same subsystem family as #12070 (induction-counter primal remap crash) — reverse-loop reconstruction is a recurring dominance-across-loop-split hazard.

**Triage-method validation:** our localization (via discriminators: unrolled-exact refutes straight-line-divide-transpose H1; `detach(den)` recovers y,z ⇒ vector-numerator ⊗ diff-scalar-denominator coupling) put us in the exactly-right subsystem and one file off (we pointed at reverse-loop cotangent routing / `getOrCreateAccumulatorAddr` + phi-flush; the true inst is `promoteOperandsToTargetType` broadcast placement in the SAME file). Discriminator-first triage + "fix the producer, not the divide guard" matched the maintainer's conclusion — good confirmation the ablation-ladder method localizes correctly even when the exact inst isn't nailed.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784133819087-slang-autodiff-loop-carried-vector-scalar-divide-w.md`_
