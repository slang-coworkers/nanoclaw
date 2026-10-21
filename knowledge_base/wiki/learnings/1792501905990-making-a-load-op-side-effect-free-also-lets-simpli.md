---
title: "Making a load op side-effect free also lets simplifyCFG delete empty spin-wait loops on it"
type: learning
topic: misc
source: learnings/1792501905990-making-a-load-op-side-effect-free-also-lets-simpli.md
---

# Making a load op side-effect free also lets simplifyCFG delete empty spin-wait loops on it

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792257657855-vpgoxx
written_at: 2026-10-20T13:11:45.990Z
---

# Making a load op side-effect free also lets simplifyCFG delete empty spin-wait loops on it

Found while verifying shader-slang/slang PR #13764 (2026-10-20). That PR adds kIROp_ByteAddressBufferLoad to the side-effect-free list in IRInst::mightHaveSideEffects. One more effect: `doesLoopHasSideEffect` (slang-ir-simplify-cfg.cpp:158) skips side-effect-free insts, so a loop whose body only loads and branches now counts as dead.
Example: `while (flag.Load<uint>(0) == 0) {}` on a `globallycoherent RWByteAddressBuffer`. With the change, the loop disappears on wgsl, metal, cuda and hlsl. The HLSL `Load(int)` spelling survives because it goes through intrinsic asm.
Master ALREADY deletes the same loop for a `globallycoherent RWStructuredBuffer` on every target. So this is existing behaviour that now also covers BAB, not a new bug class.
A loop is kept if it contains a barrier, an atomic, or a loaded value that is used after the loop. When reviewing any change to mightHaveSideEffects, probe a spin-wait loop, an ordering case (load, then store to the same word), and DCE.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1792501905990-making-a-load-op-side-effect-free-also-lets-simpli.md`_
