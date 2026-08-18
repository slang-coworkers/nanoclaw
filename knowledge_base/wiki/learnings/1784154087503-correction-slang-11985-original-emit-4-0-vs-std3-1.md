---
title: "CORRECTION: slang#11985 original emit-4.0-vs-std3.1 diagnosis WAS right; my 'macOS-26 driver race' reconciliation over-corrected"
type: learning
topic: slang-compiler
source: learnings/1784154087503-correction-slang-11985-original-emit-4-0-vs-std3-1.md
---

# CORRECTION: slang#11985 original emit-4.0-vs-std3.1 diagnosis WAS right; my "macOS-26 driver race" reconciliation over-corrected

**Follow-up correcting a prior learning** ([[learning: slang#11985 Metal diagnosis was plausible-but-wrong: inferred attribute→gpu-printing link the log never supported]]). The maintainer's MERGED fix (#12009, commit a2596654f3) settled the actual cause, and it VINDICATES my ORIGINAL diagnosis, not my mid-chain reconciliation.

**#12009's confirmed root cause (deterministic, per-OS — NOT a runtime race):**
1. slang-rhi advertises Metal caps by OS version (`src/metal/metal-device.cpp`): macOS ≥26 registers `metallib_4_0`; macOS 15 only reached `metallib_3_2`.
2. Given `metallib_4_0`, Slang's emitter correctly emits the metal4.0-only `[[required_threads_per_threadgroup]]` (gated `implies(metallib_4_0)`).
3. But the downstream metal compile was hard-coded `-std=metal3.1` (`slang-gcc-compiler-util.cpp`) → metal compiler rejects the 4.0 attribute.
The fix: derive `-std=metalX.Y` from `metalLanguageVersion`, set to 4.0 when `implies(metallib_4_0)` (`slang-code-gen.cpp:783-785`, `slang-gcc-compiler-util.cpp:978-982`, new field in `slang-downstream-compiler.h`).

**What I got RIGHT originally:** the emit-4.0-attribute-vs-hard-coded-`-std=metal3.1` mismatch WAS the mechanism. My first verdict named exactly this.

**Where I OVER-corrected:** when jkwak's "flaky, only on macos-26, macos-15 passes" evidence arrived, I retracted the capability diagnosis as "plausible-but-wrong" and reframed it as a "macOS-26 Metal driver/runtime RACE." That was wrong in the OTHER direction. The correct reconciliation was subtler and I overshot it:
- The "flaky" was NOT randomness — it was the `macos-latest` image POOL being MIXED (macos-15 vs macos-26); each image is DETERMINISTIC (26 always emits+rejects the attribute, 15 never emits it). Mixed pool → looks flaky at the label level.
- The gpu-printing "zero output / silent createComputePipeline fail" that made me doubt the attribute link was just the example lacking a debug callback; #12009's instrumentation (`IDebugCallback` + `enableValidation`) surfaced the SAME `required_threads_per_threadgroup requires metal4.0` error in gpu-printing that I'd seen in the unit tests. The attribute→crash link I'd called "inferred, unsupported" was REAL; it was only invisible due to missing instrumentation.

**Meta-lesson (refines the earlier learning, doesn't negate it):** "don't infer a causal link the log never states" stands — BUT the fix for an un-observable failure is to make it OBSERVABLE (instrument it), not to swing to a competing hypothesis (driver race) that the evidence supported no better. When two symptoms share a signature (unit-tests' metal4.0 error + gpu-printing's silent fail on the same runner class), "same cause, one just lacks output" deserved equal weight with "different causes" — and instrumentation, not retraction, was the way to decide. And "flaky at the CI-label level" ≠ "non-deterministic mechanism" when the runner pool is heterogeneous (macos-latest = macos-15 + macos-26). Weight per-image determinism before concluding "race."

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1784154087503-correction-slang-11985-original-emit-4-0-vs-std3-1.md`_
