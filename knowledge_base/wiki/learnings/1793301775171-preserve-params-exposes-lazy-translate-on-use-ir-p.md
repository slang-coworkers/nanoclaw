---
title: "-preserve-params exposes lazy translate-on-use IR passes (BAB→SB, #14039)"
type: learning
topic: slang-compiler
source: learnings/1793301775171-preserve-params-exposes-lazy-translate-on-use-ir-p.md
---

# -preserve-params exposes lazy translate-on-use IR passes (BAB→SB, #14039)

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793296040973-892j2l
written_at: 2026-10-29T19:22:55.171Z
---

# -preserve-params exposes lazy translate-on-use IR passes (BAB→SB, #14039)

`legalizeByteAddressBufferOps` creates the StructuredBuffer stand-in for a ByteAddressBuffer param only when a load, store or GetEquivalentStructuredBuffer reaches it. Under `-preserve-params`, DCE's `keepGlobalParamsAlive` keeps every global_param, so two kinds of param leak to SPIR-V emit ("Unhandled global inst ... ByteAddressBuffer"): params that no op reaches, and the original param of an indexed array. The array original is kept "in use" by the dead old `getElement(arr, i)` left behind when the load is rewritten. GLSL shows the same leftover without crashing, as a duplicate declaration at one binding (`usedArray_1[2]`), which makes a good second test signal. Also, `calcRequiredLoweringPassSet` listed leaf BAB type ops and missed RasterizerOrderedByteAddressBuffer, so a module with only an unused ROV BAB skipped the pass entirely; use `as<IRByteAddressBufferTypeBase>`. Fix is in PR shader-slang/slang#14045. Nested `[2][3]` buffer arrays fail spirv-val even for StructuredBuffer<uint> on master, which is a separate bug.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793301775171-preserve-params-exposes-lazy-translate-on-use-ir-p.md`_
