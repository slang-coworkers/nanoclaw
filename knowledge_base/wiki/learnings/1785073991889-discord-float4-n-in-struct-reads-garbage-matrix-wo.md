---
title: "Discord: 'float4[N] in struct reads garbage, matrix works' + 'upgraded for descriptor heap' = bug #11483"
type: learning
topic: misc
source: learnings/1785073991889-discord-float4-n-in-struct-reads-garbage-matrix-wo.md
---

# Discord: 'float4[N] in struct reads garbage, matrix works' + 'upgraded for descriptor heap' = bug #11483

When a user reports a struct member array (float4[N], float[N]) reads garbage but a matrix (float2x4 etc.) reads fine, AND they mention descriptor heap / spvDescriptorHeapEXT / bindless — this is very likely known bug **#11483**, NOT a plain std140 layout regression.

Root cause (verified via #11483 maintainer analysis, `source/slang/slang-emit-spirv.cpp` `getPointerArrayStrideValue`): a `ConstantBuffer<T>` fetched through the descriptor heap lowers to an `OpBufferPointerEXT` pointer in the SPIR-V **`Uniform`** storage class. `getPointerArrayStrideValue` only emits a pointer-type `ArrayStride` for `PhysicalStorageBuffer`/`StorageBuffer` (returns 0 for Uniform, which uses logical addressing where stride lives on the array type). So the heap CB pointer + its nested-array element pointers get NO pointer-type ArrayStride → indexing any nested array through that pointer has undefined offsets → garbage. Leading scalar (offset 0) is unaffected. A matrix member is indexed via MatrixStride (on the type), so it dodges the bug entirely — which is why swapping float4[2]→float2x4 "fixes" it but won't scale past 4 rows (float4[6] has no matrix equivalent).

- **Fixed by #11647** (merged 2026-07-07, Closes #11483) — retypes the heap CB load to StorageBuffer class in slang-ir-spirv-legalize.cpp. Tell users to update FORWARD to latest, not downgrade.
- **Caveat: #12226** (OPEN as of 2026-07-26, regression+reproduced) — #11647 introduced a follow-on: for struct/array `ConstantBuffer<T>` via heap, the descriptor KIND is fetched as storage-buffer instead of uniform-buffer. Re-verify after updating.
- **Scalable workaround:** fetch via `StructuredBuffer<T>`/`DescriptorHandle<StructuredBuffer<T>>` (already emits StorageBuffer pointers WITH correct strides — bind a storage-buffer descriptor host-side), or push-constant buffer-device-address (PhysicalStorageBuffer). Every storage class that reads correctly is non-Uniform.

Diagnostic tell: the col→row matrix-layout switch is a red herring — the real signal is "descriptor heap" + "nested array garbage, scalar/matrix fine." Per prior corrections, still CONFIRM the user is on the heap/bindless path (ResourceDescriptorHeap[]/DescriptorHandle/getDescriptorFromHandle) before fully anchoring — but the array-vs-matrix split + heap context is a strong match.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1785073991889-discord-float4-n-in-struct-reads-garbage-matrix-wo.md`_
