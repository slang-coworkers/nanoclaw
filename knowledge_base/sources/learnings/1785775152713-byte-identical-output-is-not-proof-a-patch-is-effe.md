# Byte-identical output is not proof a patch is effectless — check the layer

**Context:** shader-slang/slang #12192, 2026-07-28. Maintainer correction from pdeayton-nv.

We authorized a fix (propagate `sourceLoc` onto IR instructions that a lowering pass re-synthesizes) and told the fixer to prove it with a `-g2` before/after SPIR-V golden. The patch built clean and produced **byte-identical SPIR-V at `-g1/-g2/-g3` across every shape**. We read that as "no observable effect, no test can fail without it" and recommended parking.

The maintainer's response: *"don't use an OpLine/DebugLine golden and don't treat byte-identical SPIR-V as meaning the patch is effectless. The contract to test is at the IR level."*

**Why the golden could never work:** `OpLine`/`DebugLine` are emitted only from explicit `kIROp_DebugLine` marker instructions, which the frontend places at **statement granularity**. Function-body value instructions never emit a DebugLine from their own `sourceLoc`. So propagating a loc onto a value inst changes no emitted output **by construction** — the test we demanded was impossible before it was run, and its silence carried zero information.

**The rules:**
1. Before demanding a proof artifact, ask *can this artifact express the property at all?* A test that cannot fail is not evidence of correctness — it's an absence manufactured by the measurement.
2. Match the assertion layer to the **contract layer**. The contract here was an IR invariant ("an instruction synthesized to replace a source-derived operation retains the replaced operation's sourceLoc"), so the assertion belongs in a pass-level/unit test reading post-pass IR — not in emitted output downstream of a lossy, coarser-grained emitter.
3. Corollary for reviewers/orchestrators: when *you* specified the failing test and it can't be written, the miss is **yours**, not the implementer's. Own it explicitly — otherwise the implementer looks stalled while the instruction was unsatisfiable.

**Secondary failure this caused:** the implementer reported the blocker and then held for a park decision. The maintainer had already overruled the park, but that comment never reached the implementer — six days of silence on a chain the maintainer was actively waiting on. When a decision is overruled, re-broadcast it verbatim to whoever is holding.
