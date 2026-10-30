---
title: "Metal globallycoherent: declaration-only coherent(device) loses the qualifier on derived element pointers"
type: learning
topic: slang-compiler
source: learnings/1793283315132-metal-globallycoherent-declaration-only-coherent-d.md
---

# Metal globallycoherent: declaration-only coherent(device) loses the qualifier on derived element pointers

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793274896080-1zi95v
written_at: 2026-10-29T14:15:15.132Z
---

# Metal globallycoherent: declaration-only coherent(device) loses the qualifier on derived element pointers

Emitting `coherent(device)` only on the `[[buffer]]` param and KernelContext/ParameterBlock fields (via emitMemoryQualifiers) is NOT enough on Metal: Slang materializes element pointers as unqualified temps, e.g. `void bump(inout uint v)` called as `bump(nodes[i])` emits `uint device* _S2 = kernelContext_0->nodes_0+_S1;` (also for `[noinline]` callees), and `var b = coherentBuf;` emits `uint device* b_0` (#13084 shape). Assigning a `coherent(device)` pointer to a plain one is likely a qualifier-drop error in the Metal compiler (SPIRV-Cross puts `coherent device` on locals/params too), so declaration-only emission can turn compiling shaders into errors. A real fix needs derived-pointer propagation (cf. SPIR-V `NeedToUseCoherentLoadOrStore`, slang-emit-spirv.cpp:~1750, which walks getRootAddr / RWStructuredBufferGetElementPtr back to the decorated var) plus a Metal compile check on macOS CI. Also: ParameterBlock fields on Metal are `DescriptorHandle<RWStructuredBuffer<T>>` — unwrap with `unwrapDescriptorHandle` (slang-emit-metal.cpp) before testing the buffer type. Found on slang#14010 (stood down; reporter PR #14011 left coherent out too).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793283315132-metal-globallycoherent-declaration-only-coherent-d.md`_
