---
title: "slang#12040 IR type-legalization O(N²) root cause is the per-round module-wide scratch reset + presence-gated re-queue"
type: learning
topic: slang-compiler
source: learnings/1783674869932-slang-12040-ir-type-legalization-o-n-root-cause-is.md
---

# slang#12040 IR type-legalization O(N²) root cause is the per-round module-wide scratch reset + presence-gated re-queue

**Issue:** shader-slang/slang#12040 — quadratic compile time in `IRTypeLegalizationPass` on straight-line functions (loop-unroll/inline shape). Confirmed by source inspection at master HEAD 258a984c1.

**Where the quadratic lives (`source/slang/slang-ir-legalize-types.cpp`):**
- `struct IRTypeLegalizationPass` @3698. Two scratch bits (@3695-3696): bit0 `kHasBeenAddedOrProcessedScratchBitIndex` (persistent "ever added/processed"), bit1 `kHasBeenAddedScratchBitIndex` ("added THIS round").
- `processModule` @3796 has a round loop `while (workList.getCount()!=0)` @3805. **`resetScratchDataBit(module->getModuleInst(), kHasBeenAddedScratchBitIndex)` is INSIDE the loop @3819** — and its definition (`slang-ir-util.cpp:1972`) iteratively walks *every* decoration/child of the whole module. → **Mechanism 2: O(module) × O(rounds).**
- Re-queueing (`maybeAddToWorkList` @3915, `addToWorkList` @3785) is gated only on bit1 (presence-on-worklist) + parent/type/all-operands-added. It never checks whether an operand's legalized value actually *changed*, and `processInst` @3856 has no already-processed early-out. Since bit1 is wiped every round, already-finalized insts get re-legalized and re-enqueue their users each round. On a straight-line dependence chain the ready-frontier advances ~O(1) insts/round → **Mechanism 1: O(N) rounds × O(N).**

**Why it compounds:** the pass runs 3-4× per compile — `legalizeExistentialTypeLayout`/`legalizeResourceTypes`/`legalizeEmptyTypes` (`slang-emit.cpp:1775/1794/1802/1812/2419`) and again via `legalizeIRForSPIRV`→`legalizeEmptyTypes` (`slang-ir-spirv-legalize.cpp:2989`). All three variants route through the SAME `legalizeTypes`→`processModule` (@3953/@4099-4119), so a single fix covers all invocations.

**Fix shape (author jvepsalainen-nv's own proposal, recommended):** re-queue a user only when an operand's legalized value actually changed; drop the per-round full-module bit reset (clear only bits the round set, or use a round-stamp in `scratchData`). This is the type-legalization analogue of the already-MERGED #11954 (simplifyIR fixpoint quadratic, same author). **Load-bearing correctness point:** the "operand changed" predicate MUST treat inst *replacement* (`legalVal.flavor==simple` sets a new `irValue` @3899-3901) and struct→tuple splitting as a change, or a dependent inst gets skipped.

**Verification:** behavior-preserving — existing legalization correctness suites (`tests/legalization/`, `tests/compute/*legalize*`, dynamic-dispatch/existential tests) must stay green (no GPU needed); the #12023 compile-perf sweep ladders should drop from ∝N^1.8-2.0 toward ∝N^1.0-1.2. Note the repro is a Python generator + the #12023 ladders are NOT in-tree yet (PR #12023 open) — so `reproduced` label was withheld (mechanism confirmed by code, not by a warm timing run).

**Routing pattern (3rd instance):** external CONTRIBUTOR who self-files AND self-assigns, ships a complete diagnosis+fix recipe, and has already landed the analogous sibling fix → same profile as #12038 (parked) and generalizes [[feedback_no_autofixer_jkwak_self_filed]]. Correct posture: post the verified 5-bullet verdict + set Issue Type, then HOLD at "triaged" and let the parent decide park-vs-dispatch rather than auto-racing slang-fixer against the owner who is plainly on it.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1783674869932-slang-12040-ir-type-legalization-o-n-root-cause-is.md`_
