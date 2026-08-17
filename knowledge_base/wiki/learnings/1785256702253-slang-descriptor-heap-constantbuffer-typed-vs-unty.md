---
title: "slang descriptor-heap ConstantBuffer: typed-vs-untyped OpBufferPointerEXT — Uniform IS possible via untyped path (glslang), but Slang's typed pipeline makes it non-local"
type: learning
topic: slang-compiler
source: learnings/1785256702253-slang-descriptor-heap-constantbuffer-typed-vs-unty.md
---

# slang descriptor-heap ConstantBuffer: typed-vs-untyped OpBufferPointerEXT — Uniform IS possible via untyped path (glslang), but Slang's typed pipeline makes it non-local

**Context:** slang#12226 re-open. Reporter refuted jkwak's "Uniform can't take a pointer to an array element" by-design ruling with a glslang GL_EXT_descriptor_heap shader: a UNIFORM heap buffer with nested `float[5]`, indexed, keeps Uniform + spirv-val accepts. Investigation-only findings (verified @HEAD dd6e011e56 + local slangc):

**Root mechanism = TYPED vs UNTYPED buffer-DATA pointer:**
- Slang: `emitDescriptorHeapLoad` (slang-emit-spirv.cpp:7594) emits the heap-ARRAY index via `OpUntypedAccessChainKHR`+`OpTypeUntypedPointerKHR UniformConstant` (:7606), then the buffer-DATA pointer via `OpBufferPointerEXT` whose Result Type = `inst->getDataType()` = a **TYPED IRPtrType**. Field/elem access on it → **typed `OpAccessChain`**. A typed pointer to an array element needs a **pointer-type ArrayStride**, emitted ONLY for StorageBuffer/PhysStorageBuffer (`getPointerArrayStrideValue`:2016, emit site :2563). That's why #11647 flipped struct CB heap fetches to StorageBuffer.
- glslang: buffer-data pointer is **untyped Uniform** + field/elem access via `OpUntypedAccessChainKHR` passing the block-struct type → stride from the TYPE's decorations (logical addressing) → Uniform works, no pointer-type ArrayStride.
- **Whole Slang emitter has only 3 `OpUntypedAccessChainKHR` sites (emit-spirv.cpp:5084 texel, :7578 AS-heap-index, :7606 buffer-heap-index) — NONE does field/element access on buffer data.** glslang's untyped-data-access path does not exist in Slang.

**Two nuances that correct the common framing:**
1. Slang ALREADY emits typed **Uniform** OpBufferPointerEXT + typed `OpAccessChain %_ptr_Uniform_float` for scalar/vector/matrix CB heap elements, and it validates (tests/spirv/descriptor-heap-constant-buffer-non-struct.slang:86,90,93). So "Uniform can't address a CB element" is false in general — it's specifically **array-element** addressing through a TYPED heap buffer pointer.
2. The StorageBuffer flip is OVER-BROAD: `processConstantBufferDescriptorHeapLoad` (slang-ir-spirv-legalize.cpp:1315) gates on `as<IRStructType>(elementType)` = EVERY struct, even no-array structs. `ConstantBuffer<struct{float value;}>` → StorageBuffer descriptor for a plain field access needing zero stride. Could narrow the gate to structs that actually contain arrays → gives no-array CBs the correct Uniform descriptor kind cheaply.

**Feasibility of the glslang-style untyped-Uniform path:** spec-legal (the two SPV_EXT_descriptor_heap storage-class operands are independent — see the companion learning), but NOT localized. Slang carries element-type + address-space SOLELY in the typed IRPtrType through the whole legalize→emit pipeline: `emitFieldAddress`:8580 reads `ptrType->getValueType()`; `emitGetElementPtr`:8650 + `processFieldAddress`:1475 propagate address space; `emitStructuredBufferGetElementPtr` assumes typed OpAccessChain. An untyped data pointer needs ~5-8 new untyped-aware consumers (IR GEP/field-address insts have no type-operand slot, so the block-struct type must be threaded in parallel). Emitter-architecture extension, not a class flip.

**jkwak's `-spirv-unified-descriptor-heap-stride` workaround fixes STRIDE, not descriptor KIND:** verified — with the flag, `OpTypeBufferEXT StorageBuffer` + `%_ptr_StorageBuffer_...` remain for the CB heap fetch; the `OpTypeBufferEXT Uniform` that appears is only the max()-computation operand. So it addresses the size/spacing symptom, not the uniform-vs-storage descriptor interpretation.

**Meta:** a bound `[[vk::binding]] ConstantBuffer<float>[4]` proves logical typed-Uniform array-element access works in Slang (constant-buffer-array-non-struct.slang:23-26, typed OpAccessChain, no pointer-type ArrayStride) — because it's an OpVariable (intrinsic logical addressing), unlike the heap OpBufferPointerEXT result which is a pointer into buffer memory.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785256702253-slang-descriptor-heap-constantbuffer-typed-vs-unty.md`_
