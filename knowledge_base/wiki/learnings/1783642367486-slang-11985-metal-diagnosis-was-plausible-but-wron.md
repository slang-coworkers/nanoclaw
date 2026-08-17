---
title: "slang#11985 Metal diagnosis was plausible-but-wrong: inferred attribute→gpu-printing link the log never supported; real cause macOS-26 flake"
type: learning
topic: slang-compiler
source: learnings/1783642367486-slang-11985-metal-diagnosis-was-plausible-but-wron.md
---

# slang#11985 Metal diagnosis was plausible-but-wrong: inferred attribute→gpu-printing link the log never supported; real cause macOS-26 flake

**What happened:** Triaged #11985 macOS CI flake and posted a confident root cause — Slang emits the Metal-4.0-only `[[required_threads_per_threadgroup]]` attribute by default, rejected on older `<4.0` Metal → gpu-printing exit 255. Code trace was real (emit gate `implies(metallib_4_0)` @slang-emit-metal.cpp; `metallib_latest=metallib_4_0` since PR #10592). But the maintainer's local agent later showed the diagnosis was **plausible-but-wrong on the operative cause**, and I had to retract publicly.

**The two errors, both avoidable:**
1. **Inference presented as fact.** The `metal4.0`-attribute error in the CI log appeared ONLY in the `slang-test` unit tests (`gfx-unit-test-tool/*Metal.internal`) — which CLEARED ON RETRY. The actual job failure, `gpu-printing`, produced **ZERO output** and failed silently at `createComputePipeline`. I *inferred* the attribute caused gpu-printing's exit-255; the log never showed a metal error in gpu-printing at all. Two co-located symptoms ≠ same cause.
2. **Mechanism predicted the inverse of the data.** My "rejected on OLDER <4.0 Metal" implies DETERMINISTIC failure on OLD runners. Real data (maintainer's 12-run correlation): FLAKY, only on the NEWEST macos-26-arm64 "Tahoe" image (mixed into macos-latest ~Jul 5), macos-15 passing. Flaky-on-new refutes deterministic-on-old. The failing log I analyzed was itself macos-26.4 — I had the runner image in hand and didn't weight it.

**Root lesson (reinforces [[feedback_hedge_root_cause_in_public_verdict]]):** when a root cause is from code-trace + a NON-reproduced runtime hypothesis, the causal link between the observed failure and the traced code is itself a HYPOTHESIS — label it, don't state it as the verdict. Before blaming a compiler mechanism for an intermittent CI failure: (a) confirm the error signature actually appears in the FAILING step's output, not just a co-located step; (b) check whether the failing step recovered on retry (flaky→environmental, not deterministic-codegen); (c) weight runner-image/OS correlation — a flake correlating with a NEW OS image is a driver/runtime change, not a static capability mismatch; (d) a silent exit-255 with no diagnostic points at RHI/device/driver, not at shader compilation (which prints diagnostics).

**What survived:** the emit-vs-`-std=metal3.1` attribute inconsistency is a genuine LATENT bug (real unit-test errors), worth fixing on its own merits — but it was NOT the operative cause. Kept it as "PR #10592 introduced a latent inconsistency," retracted it as "the cause of the flake."

**Handling when challenged:** reconcile honestly, don't defend. Re-read the primary evidence (the log) yourself, concede where the maintainer's evidence is stronger, and post a public correction that separates what survives from what's retracted. Real operative cause here = macOS-26 Metal driver/runtime race on device/pipeline creation; mitigated by disabling the example (#11995), diagnosis pending instrumentation (#11999/PR #12009). See [[learning: slang#11985 macOS CI flake = Metal 4.0 attribute emitted vs sub-4.0 compile target]] (the now-corrected earlier learning).

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783642367486-slang-11985-metal-diagnosis-was-plausible-but-wron.md`_
