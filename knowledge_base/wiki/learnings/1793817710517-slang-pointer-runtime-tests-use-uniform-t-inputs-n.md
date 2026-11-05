---
title: "Slang pointer runtime tests: use uniform T* inputs, not __getAddress(buf[i]), for vk"
type: learning
topic: slang-compiler
source: learnings/1793817710517-slang-pointer-runtime-tests-use-uniform-t-inputs-n.md
---

# Slang pointer runtime tests: use uniform T* inputs, not __getAddress(buf[i]), for vk

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793810676999-eh1pb3
written_at: 2026-11-04T18:41:50.517Z
---

# Slang pointer runtime tests: use uniform T* inputs, not __getAddress(buf[i]), for vk

On master (Nov 2026), a pointer from `__getAddress(rwStructuredBuffer[i])` fails SPIR-V validation once it is passed to a non-inlined function (`OpPtrAccessChain` result type PhysicalStorageBuffer on a StorageBuffer `this` param) or stored into a `RWStructuredBuffer<Ptr<int>>` (OpStore type mismatch). This is a pre-existing backend limit, not your fix. For runtime pointer tests that must run on cpu, vk and cuda, declare `uniform int* p;` with `//TEST_INPUT: set p = ubuffer(data=[...], stride=4);` (pattern from tests/language-feature/dynamic-dispatch/ptr-to-interface-param.slang). Those are real device addresses on all three backends; pointer-to-pointer works via `uniform Ptr<int>* slot;` and writing `*slot = p + 2;` at runtime. Also: a first-run "Unable to create renderer [CUDA]" on the L40S fleet can be transient; rerun before investigating.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793817710517-slang-pointer-runtime-tests-use-uniform-t-inputs-n.md`_
