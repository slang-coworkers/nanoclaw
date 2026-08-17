---
title: "Descriptor-heap ConstantBuffer StorageBuffer flip (#11647) is deliberate — descriptor kind vs pointer addressing class conflated"
type: learning
topic: misc
source: learnings/1784939222858-descriptor-heap-constantbuffer-storagebuffer-flip-.md
---

# Descriptor-heap ConstantBuffer StorageBuffer flip (#11647) is deliberate — descriptor kind vs pointer addressing class conflated

**Context:** shader-slang/slang#12226 — a struct-typed `ConstantBuffer<T>` fetched bindlessly via `ResourceDescriptorHeap[]` / `DescriptorHandle<ConstantBuffer<T>>` under `-capability spvDescriptorHeapEXT` emits SPIR-V that reads a **StorageBuffer** descriptor from the heap instead of a **Uniform** (uniform-buffer) descriptor. Real ABI consequence: on the reporter's driver a uniform descriptor is 8B and storage is 16B → 8 bytes of garbage read.

**The trap (what a naive code-trace concludes vs the truth):** The obvious fix is "change `ConstantBuffer` → Uniform in the descriptor-heap path." That is WRONG and regresses #11483. `processConstantBufferDescriptorHeapLoad` (`source/slang/slang-ir-spirv-legalize.cpp:1300`) *deliberately* retypes struct/array descriptor-heap ConstantBuffer loads to StorageBuffer — added by **PR #11647 / commit 012051b2 (szihs, merged jkwak-work 2026-07-07)** to fix #11483 (nested-array members read garbage). Reason: a Uniform-class `OpBufferPointerEXT` buffer pointer carries **no pointer-type `ArrayStride`** — `getPointerArrayStrideValue` (`slang-emit-spirv.cpp:2016`) emits it only for StorageBuffer/PhysicalStorageBuffer (Uniform = logical addressing, stride on the array *type* not the pointer). So nested-array addressing through a Uniform buffer pointer computed undefined offsets.

**Root insight:** The descriptor *kind* fetched from the heap (uniform-buffer vs storage-buffer — an ABI fact, and it also sets the heap index stride via `OpConstantSizeOfEXT` on the `OpTypeBufferEXT`) is **conflated** with the buffer-pointer *addressing class* (which needs StorageBuffer for pointer-type ArrayStride). #11647 fixed the addressing symptom by changing the descriptor kind — the wrong lever for ConstantBuffer.

**Verified behavior (local slangc `-O0` + local `spirv-dis`, HEAD 5281ccc66):** element-shape-dependent — SCALAR `ConstantBuffer<float>` via heap → `OpTypeBufferEXT Uniform` (correct); STRUCT/array `ConstantBuffer<Struct>` via heap → `OpTypeBufferEXT StorageBuffer` (the bug). Two forms of the same type fetch different physical descriptor kinds.

**Open spec question (unresolved):** Does `SPV_EXT_descriptor_heap` REQUIRE the `OpTypeBufferEXT` (descriptor element) storage class and the `OpBufferPointerEXT` result-pointer storage class to MATCH? DeepWiki claims yes (would make "decouple kind from addressing class" infeasible and force fixing addressing within Uniform). Not verifiable from the local checkout — the spec isn't cloned. Check `external/spec` (clone from github.com/shader-slang/spec) before implementing.

**Container tip:** in this triage container `slangc -target spirv-asm` fails (`failed to load slang-glslang` / spirv-dis). Workaround: `slangc -O0 -target spirv -skip-spirv-validation -o out.spv` (the `-O0` avoids the spirv-opt/glslang downstream dependency) then disassemble with the in-tree `build/external/spirv-tools/tools/Debug/spirv-dis`.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784939222858-descriptor-heap-constantbuffer-storagebuffer-flip-.md`_
