---
title: "slang autodiff: vector-by-scalar divide loses gradients only inside a loop, not the divide transpose (slang#12071)"
type: learning
topic: slang-compiler
source: learnings/1783885532350-slang-autodiff-vector-by-scalar-divide-loses-gradi.md
---

# slang autodiff: vector-by-scalar divide loses gradients only inside a loop, not the divide transpose (slang#12071)

**Bug (slang#12071, escalated from slangpy#1055):** `bwd_diff` of a `[Differentiable]` function that divides a **loop-carried differentiable `float3` accumulator by a differentiable scalar** (both built from a shared loop weight `w`) produces silently-wrong input gradients. Reproduced at HEAD 8f0c3515d on the **CPU** target (`slang-test -cpu -output-using-type`), worst |bwd − centralFD| = 0.907; scalar/scalar control exact.

**The load-bearing discriminator — always run it before blaming the straight-line op:** replace the `[MaxIters]` loop with an explicit **unrolled** body (same math). If the unrolled form is exact and only the looped form fails, the trigger is the **loop-carried reverse reconstruction**, NOT the arithmetic-op transpose. Here the unrolled vector/scalar divide was exact (0.00003) → this REFUTED the plausible hypothesis that the `Div` transpose drops the denominator gradient.

**Why that hypothesis was wrong (verified in source at HEAD):** division is `[Differentiable]` with no custom derivative, so fwd-mode synthesizes the quotient rule (`slang-ir-autodiff-fwd.cpp:466-486`) with `diffMul = den*den` marked **primal**. The `Div` transpose (`slang-ir-autodiff-transpose.cpp:2549-2563`) only handles a differential numerator and its `SLANG_RELEASE_ASSERT(!isDifferentialInst(getOperand(1)))` at :2553 therefore **passes** — not the break. The scalar→vector operand splat (`promoteOperandsToTargetType`:2406) is correctly reversed by `transposeMakeVectorFromScalar`:1756 via `kIROp_SumVectorElements`, and the emitted CUDA contains that lane-reduction. So the straight-line machinery is complete; the fault is in reverse-pass reconstruction of the loop-carried vector accumulator (same subsystem as #12070's primal-hoist).

**Signature that localizes it:** the pure-vector gradient channels (`x.y`,`x.z` — which flow ONLY through `num += x[i]*w`, never through `w`/`den`) drop to **exactly 0.0** (true ≈0.195). `detach(den)` recovers them, so the coupling of the loop-carried vector numerator with the differentiable scalar denominator is the locus.

**Verified user workaround:** do the divide in scalar space — `float s = num.x+num.y+num.z; return s/den;` is exact; or divide component-wise through scalar temporaries. `detach(den)` only partially works (drops the denominator's own gradient).

**Tooling note:** `slangi` (bytecode interpreter) is an UNRELIABLE oracle for autodiff-over-`float3[N]`-`[MaxIters]` programs — primal `G` returned `-inf` and the FD sweep hung. Use `slang-test -cpu -output-using-type` with a `RWStructuredBuffer<float>` output + `//TEST_INPUT:ubuffer(...)` instead; it does the marshalling and dumps the buffer to `<test>.actual.txt` for exact numeric inspection.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783885532350-slang-autodiff-vector-by-scalar-divide-loses-gradi.md`_
