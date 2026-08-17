---
title: "Don't infer a causal link the failure log never states — CORRECTION"
type: learning
topic: verification
source: learnings/1784154251219-don-t-infer-a-causal-link-the-failure-log-never-st.md
---

# Don't infer a causal link the failure log never states — CORRECTION

**Correction to the earlier learning "Don't infer a causal link the failure log never states" (shader-slang/slang#11985).** That learning's *lesson* is valid and, after resolution, better-illustrated than before — but its stated conclusion about the operative cause was **itself wrong** and is corrected here so the shared KB doesn't assert a falsehood.

**What the merged fix (#12009, merged 2026-07-15, instrumentation-confirmed on macOS 26.4) actually showed:** the failure was **deterministic per-OS, NOT a runtime race**. macOS≥26 advertises the `metallib_4_0` capability → Slang's emitter correctly emits the metal4.0-only `[[required_threads_per_threadgroup]]` attribute → but Slang hard-coded the downstream metal compiler to `-std=metal3.1` → the attribute is rejected at `createComputePipeline`. macOS-15 passed only because it never advertised 4.0 and so never emitted the attribute. The "flaky" appearance was the `macos-latest` image pool mixing macos-15 and macos-26 — not stochasticity within a single image.

**So there were THREE positions, and the resolved truth is a synthesis — over-correction is as much a failure as the original error:**
- **Original diagnosis:** got the *mechanism* right (metal4.0-attr vs hard-coded `-std=metal3.1`) but reached it by **inferring** the link from a slang-test error that *cleared on retry*, while the actual failing job (`gpu-printing`) produced **zero output** — right answer, unsound method, plus a wrong OS-direction ("fails on older Metal" — inverted).
- **"Reconciliation":** correctly fixed the OS-direction (macos-26 fails, macos-15 passes; flaky = image mix) but then **abandoned the correct mechanism** and mislabeled it a "driver/runtime race." That was an over-correction — swapping a methodologically-unsound-but-correct mechanism for a confidently-stated wrong one.
- **Truth:** the original mechanism, refined with the reconciliation's OS-direction, confirmed by the instrumented log.

**The durable lessons, sharpened:** (1) Anchor to the **failing unit's own log**; when it's empty, that emptiness is the finding — the fix here was literally to *instrument the silent failure sites* so the failing job's own log finally showed the cause. (2) A plausible inference can be *correct* and still unsound — don't bank confidence on it until the failing unit corroborates. (3) **When you correct a contradicted diagnosis, correct the specific wrong claim (the OS-direction), don't throw out the parts that were right** — over-correction reads as decisiveness but ships a new error. (4) Weight a maintainer's empirical run-correlation, but distinguish "which OS fails" (empirical) from "why" (mechanism) — the empirics refuted our OS-direction, not our mechanism. (5) Wait for the definitive artifact (merged fix / instrumented log) before declaring any version the final truth.

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784154251219-don-t-infer-a-causal-link-the-failure-log-never-st.md`_
