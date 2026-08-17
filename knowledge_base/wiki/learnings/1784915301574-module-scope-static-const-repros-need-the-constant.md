---
title: "Module-scope static-const repros need the constant CONSUMED or DCE masks the bug"
type: learning
topic: misc
source: learnings/1784915301574-module-scope-static-const-repros-need-the-constant.md
---

# Module-scope static-const repros need the constant CONSUMED or DCE masks the bug

When reproducing a compiler bug that fires on a **module-scope `static const`** initializer (e.g. shader-slang/slang#12219: SCCP fails to fold a DescriptorHandle/vector constant, leaving `castFloatToInt`/`bitCast` alive at global scope → `emitGlobalInst` "Unhandled global inst in spirv-emit" abort), the naive repro that just declares the constant and reads it into an unused local **compiles clean (EXIT=0)** — dead-code elimination drops the unused global before it reaches emit, masking the bug.

Fix: make the constant **observably consumed** — store it into a `RWStructuredBuffer` from the entry point:
```slang
static const uint2 kBufBits = (uint2)kBuf;
RWStructuredBuffer<uint2> outp;
[shader("compute")] [numthreads(1,1,1)]
void computeMain() { outp[0] = kBufBits; }
```
Then the abort reproduces on master. This is the classic "verify to ground truth before confirming a root cause" trap: a green compile on the pre-analysis's verbatim repro is NOT evidence the bug is unreal — check whether DCE ate it first.

Second, orthogonal finding from the same issue: plain `uint2(float2(3.0,4.0))` folds fine (`OpConstantComposite %v2uint`), but wrapping it in a `DescriptorHandle` representation-cast round-trip (`CastUInt2ToDescriptorHandle`→`CastDescriptorHandleToUInt2`) interrupts the frontend fold and leaves the numeric-conversion inst alive at global scope. The offender at emit is the cast feeding the composite, not `MakeVector` (which `emitGlobalInst` already handles as `OpConstantComposite`) — so the right layer is SCCP (`isEvaluableOpCode` + the scalar/packed-float gate at `slang-ir-sccp.cpp:1026`), not new emit handlers.

Third: when a proposed-work item references code added by an *unmerged draft PR* (here #12186's `tryGetConstantDescriptorHandleBits` walker + its `SLANG_RELEASE_ASSERT`), that item is NOT actionable on master — the code doesn't exist yet. On master both repro cases hit the generic `emitGlobalInst` abort; the assert-mode is #12186-conditional. Always grep master for the referenced symbol before treating such an item as ready-for-fix.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784915301574-module-scope-static-const-repros-need-the-constant.md`_
