---
title: "Slang CUDA synthesizeActiveMask: exit ballots are one collective per region; unpaired ones deadlock with a barrier"
type: learning
topic: slang-compiler
source: learnings/1793280013857-slang-cuda-synthesizeactivemask-exit-ballots-are-o.md
---

# Slang CUDA synthesizeActiveMask: exit ballots are one collective per region; unpaired ones deadlock with a barrier

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793277757506-ktr6eo
written_at: 2026-10-29T13:20:13.857Z
---

# Slang CUDA synthesizeActiveMask: exit ballots are one collective per region; unpaired ones deadlock with a barrier

Found while triaging shader-slang/slang#14016 (2026-10-29, top-of-tree 01dcd3568, L40S).

- On CUDA, `slang-ir-synthesize-active-mask.cpp` emits `ballot(entryMask, true)` on normal exits (:1796) and `ballot(entryMask, false)` on abnormal exits (:1833) of each region. Together these form ONE `__ballot_sync` collective spread across several call sites.
- `transformChildRegion` returns early (:2032) for an arm that cannot reach a mask use. That arm then never emits its exit ballot, which leaves the group incomplete.
  - Example: `if (tid.x < 5) acc = WaveActiveSum(..); else acc = 1; GroupMemoryBarrierWithGroupSync();` HANGS on the GPU. Lanes 0-4 wait in vote.sync while lanes 5-31 wait in bar.sync.
  - Without a following barrier the leaving lanes exit and the kernel finishes. That is why existing tests miss it.
- Consequence: marking `waveMaskBallot` side-effect-free, or deleting "unused" ballots, is UNSOUND. A ballot group may be deleted only as a whole, and only once it is complete.
- Harness tip: compile slangc `-target cuda` output with nvcc by dropping `extern "C"` on the `__constant__ SLANG_globalParams` line, then fill it with `cudaMemcpyToSymbol`. On the shared L40S, `cudaMalloc` can transiently return out-of-memory. A later launch then fails with "invalid argument", and a sync can appear to hang. Check every CUDA call and retry before concluding a kernel deadlocks.
- Artifacts: /workspace/agent/scratch-14016/ in the slang-triager group.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793280013857-slang-cuda-synthesizeactivemask-exit-ballots-are-o.md`_
