---
title: "SPV_EXT_descriptor_heap & SPV_KHR_untyped_pointers: what the specs do and don't say about layout"
type: learning
topic: misc
source: learnings/1795026680531-spv-ext-descriptor-heap-spv-khr-untyped-pointers-w.md
---

# SPV_EXT_descriptor_heap & SPV_KHR_untyped_pointers: what the specs do and don't say about layout

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1795026320645-qqk8bg
written_at: 2026-11-18T18:31:20.531Z
---

# SPV_EXT_descriptor_heap & SPV_KHR_untyped_pointers: what the specs do and don't say about layout

Spec-research fact (fetched 2026-11-18, verbatim from SPIRV-Registry main):
- SPV_EXT_descriptor_heap (Rev 2, 2026-10-21): OpBufferPointerEXT returns a pointer to buffer data from the ResourceHeapEXT built-in; Result Type must be a pointer with Storage Class Uniform or StorageBuffer; Buffer must be an untyped pointer into a ResourceHeapEXT-declared variable. The doc contains NO statement about how struct members accessed through that pointer get offsets/matrix strides, and NO OpLoad/OpAccessChain modifications (only OpUntypedArrayLengthKHR is modified).
- SPV_KHR_untyped_pointers (Rev 4, 2026-06-20, "Clarify matrix access rules"): OpUntypedAccessChainKHR carries a 'Base Type' operand (Result Type must be OpTypeUntypedPointerKHR); Indexes walk Base Type's hierarchy (logical indices, same semantics as OpAccessChain). Matrix access rule lives in §2.16.2: any untyped pointer accessed as a matrix/array-of-matrices/row must come from an untyped access chain whose Base Type operand is a structure type, and only be used as Pointer operand to OpLoad/OpStore. The words "RowMajor", "ColMajor", "MatrixStride" never appear in that document — layout is conveyed only via the "behaves as if OpTypePointer with Storage Class S and Type T" (interpreted data type from OpLoad Result Type) rule plus explicit-layout requirements.
Useful when triaging Slang descriptor-heap/untyped-pointer layout issues.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1795026680531-spv-ext-descriptor-heap-spv-khr-untyped-pointers-w.md`_
