---
title: "slang#12096 ↔ #11999 share the same metallib_4_0-from-OS root (reconciling a distinct→same call)"
type: learning
topic: slang-compiler
source: learnings/1784062178778-slang-12096-11999-share-the-same-metallib-4-0-from.md
---

# slang#12096 ↔ #11999 share the same metallib_4_0-from-OS root (reconciling a distinct→same call)

Maintainer jkwak-work merged **#12096** and **#11999** as "the same root problem." I had earlier triaged #11999 as a *distinct* macOS intermittency. On re-reading the actual #11999 thread, **jkwak is right and my "distinct" was too strong** — the tell was in evidence I'd already gathered but under-weighted.

**Why they share a root (the metallib_4_0-from-OS defect at slang-rhi metal-device.cpp:266):**
1. `gpu-printing` (the #11999 example) is a **compute** example — `examples/gpu-printing/kernels.slang:17-19`: `[shader("compute")] [numthreads(32)] computeMain`. Slang emits `[[required_threads_per_threadgroup]]` ONLY for compute/mesh/amplification stages, gated on `getTargetCaps().implies(metallib_4_0)` (slang-emit-metal.cpp:215). So its `createComputePipeline` hits the exact same OS-inferred-metallib_4_0 path as #12096.
2. In the #11999 failing job, the **graphics** examples (`platform-test`, `shader-toy`, `triangle`) PASSED on the *same* failing runner and logged `GPUFamilyApple6 not supported` — i.e. a Metal device WAS created. So #11999 fails **past** createDevice, on the compute path — not a device-creation flake.
3. #11999 looked *intermittent* while #12096 is *deterministic* because `runs-on: macos-latest` served a **mix** of macos-15 (pass) and macos-26 (fail) images. Pinning to macos-15 (#12075) is what made #12096's signature deterministic. Same skew, two surfaces.

**The honest caveat:** #11999's `exit 255` was SILENT (RHI debug layers off), so the metal-compiler error was never captured directly — strongly corroborated, not yet definitively proven. My instrumentation draft **PR #12009** (labels each failure site + enables the RHI validation layer) is exactly the instrument that will confirm the shared root on the next macos-26 run.

**Triage lesson:** when classifying two failures as "distinct," weight *mechanism* (which pipeline stage / capability path) over *surface signature* (intermittent-vs-deterministic, silent-vs-printed). Intermittency can be an artifact of a runner-image lottery, not a different root cause. A silent failure that "looks different" may just be the same bug with diagnostics turned off. Re-read your own prior evidence before defending a "distinct" call — mine already contained the refutation (compute-only failure + device-was-created).

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784062178778-slang-12096-11999-share-the-same-metallib-4-0-from.md`_
