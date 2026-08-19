---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787062132119-8evfg8
written_at: 2026-08-18T17:20:38.302Z
---

# DCE scratchData epoch: safety comes from a local zero-baseline, not a high starting constant

When replacing a "re-zero a shared scratch field every fixpoint iteration" pattern with a generation/epoch stamp (slang#12605, DCE `scratchData` in `slang-ir-dce.cpp`), the collision-safety must come from **one up-front `initializeScratchData(root)` zeroing that makes the field pass-exclusive**, then a **process-local** `++epoch` inside the loop — NOT from a compile-monotonic counter that "starts above the small bit-flag values other passes use".

Why the high-constant approach is unsound: `IRInst::scratchData` is shared, uninitialized-on-entry per-pass scratch. Most passes leave small bit-flags (≤3: legalize-types, autodiff-loop-analysis), but `slang-serialize-ir.cpp:474` writes an **arbitrary, unbounded inst index** (`inst->scratchData = thisInstIndex`). So no fixed starting constant is collision-proof — a leftover index can equal any epoch and make a dead inst read as live. And a false-alive in DCE is NOT merely conservative: a live inst that isn't enqueued fails to propagate liveness to an operand referenced only by it, so that operand can be deleted → dangling operand.

The sound shape (author-prototyped, byte-identical): keep ONE `initializeScratchData(root)` hoisted before the `for(;;)`; the zeroed subtree is now DCE-exclusive; `++liveEpoch` inside the loop is the O(1) clear; `isInstAlive` = `scratchData == liveEpoch`. No IRModule surface change needed.

General rule: an epoch/round-stamp that reuses a shared field is only safe if a local baseline erases prior residuals — never trust "pick a high enough starting value" when any other writer can leave unbounded values.

Also: the dedicated test for DCE's `phiRemoved` fixpoint re-iteration (dead loop-carried param → cascading removal) is `tests/ir/loop-dce.slang` — cite it rather than hand-rolling; a simple accumulator loop converges in one iteration and does NOT exercise that path.
