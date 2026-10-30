---
title: "CUDA active-mask review: corpus ballot diff, hang timeouts under load, and __intrinsic_asm arms"
type: learning
topic: slang-compiler
source: learnings/1793295534316-cuda-active-mask-review-corpus-ballot-diff-hang-ti.md
---

# CUDA active-mask review: corpus ballot diff, hang timeouts under load, and __intrinsic_asm arms

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1793290478611-2a95ga
written_at: 2026-10-29T17:38:54.316Z
---

# CUDA active-mask review: corpus ballot diff, hang timeouts under load, and __intrinsic_asm arms

Learned while reviewing shader-slang/slang#14025 (CUDA active-mask exit-ballot deadlock + dead-ballot pruning), 2026-10-29.

- **Corpus check for passes that add or remove warp collectives.** Compile every test that uses wave ops and has `computeMain` with `-target cuda`, once with the base slangc and once with the head slangc. For each file, count `__ballot_sync|__match_any_sync` and compare exit codes. Then look at the files whose count goes **up**. On #14025, all 6 such files gained master's *missing* exit ballots on `break` arms, for example `tests/hlsl-intrinsic/wave-read-lane-at.slang`. That is a latent deadlock, which no test catches until a barrier follows the loop. The whole scan takes about 1 minute at -P 24.
- **Telling a hang from slowness.** Under container load (load average 170–220), a single CUDA COMPARE_COMPUTE test took 103 s to *pass*. A 100 s cap would have reported it as a hang. Use ≥200 s per file before calling a CUDA test a deadlock. Note that slang-test output piped into grep is block-buffered, so a timeout kill can also drop the lines for tests that already passed.
- **Not a regression: `__intrinsic_asm` statement arms.** Take a divergent arm that ends in an `__intrinsic_asm` statement (a GenericAsm terminator inside `__target_switch`). After #14025 the active-mask walk reaches that arm and hits `SLANG_UNEXPECTED("unhandled terminator op")`. Master already miscompiles the same shape: the whole helper becomes the asm and the other arm is dropped. So the ICE replaces a silent miscompile; it does not break working code. Before you report an ICE on internal syntax, check master's emitted code for that shape.
- **Hardware reconvergence.** CUDA intrinsics that read `__activemask()` directly (matrix `WaveReadLaneAt`, `WaveGetConvergedMask`) still returned results identical to vk on L40S after the pruning removed 13→5 ballots. nvcc reconverges at the merge even without those ballots.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793295534316-cuda-active-mask-review-corpus-ballot-diff-hang-ti.md`_
