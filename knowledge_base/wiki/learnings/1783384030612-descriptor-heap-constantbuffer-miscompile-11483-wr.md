---
title: "Descriptor-heap ConstantBuffer miscompile (#11483) = wrong storage class (Uniform not StorageBuffer), NOT missing ArrayStride"
type: learning
topic: misc
source: learnings/1783384030612-descriptor-heap-constantbuffer-miscompile-11483-wr.md
---

# Descriptor-heap ConstantBuffer miscompile (#11483) = wrong storage class (Uniform not StorageBuffer), NOT missing ArrayStride

**Rule:** For the spvDescriptorHeapEXT `ConstantBuffer<T>.Handle` nested-array-reads-wrong bug (#11483), the root cause is that the heap-CB fetch lowers to an `OpBufferPointerEXT` buffer pointer in the **`Uniform`** storage class when it should be **`StorageBuffer`** (a descriptor-heap buffer pointer is raw byte-addressed memory, not a bound UBO). Fix = retype the load to StorageBuffer in `slang-ir-spirv-legalize.cpp` (PR #11647's `processConstantBufferDescriptorHeapLoad`, mirroring the working `processRWStructuredBufferGetElementPtr`/StructuredBuffer-via-heap path). Do NOT frame `getPointerArrayStrideValue` (slang-emit-spirv.cpp:1993) returning 0 for Uniform as the bug — that is CORRECT SPIR-V: pointer-type `ArrayStride` only belongs on byte-addressed classes (StorageBuffer/PhysicalStorageBuffer); Uniform uses logical addressing where stride lives on the array *type*. The missing pointer-type ArrayStride is the correct downstream *symptom*; once the class flips to StorageBuffer the strides emit automatically.

**Why:** spv-val is silent because the emitted Uniform SPIR-V is internally self-consistent — it's the wrong *class*, not a validation error. This is why a "diff the ArrayStride decorations" GPU-free discriminator does NOT convince a maintainer (it's not self-failing, and needs eyeball-diffing). The self-failing repro is a static `//TEST:SIMPLE(filecheck)` spirv-asm test asserting `OpTypePointer StorageBuffer` + `OpDecorate %_ptr_StorageBuffer__arr_… ArrayStride 16/64/256` — fails on master, passes with the fix (#11647 ships `tests/spirv/descriptor-heap-constant-buffer-nested-array-stride.slang`).

**How to apply:** A runtime `//TEST:COMPARE_COMPUTE` for this CANNOT be authored today — the render-test harness can only heap-bind buffer/texture/sampler `.Handle`s, not a `ConstantBuffer<T>.Handle` (verified: every in-tree `getDescriptorFromHandle`/`.Handle(` test is static `//TEST:SIMPLE`, none runs on-device). A StructuredBuffer.Handle "proxy" (e.g. draft #11639) is a FALSE NEGATIVE — it lowers to StorageBuffer, the path that already works, so it stays green whether or not the bug is present. On-HW wrong-data confirmation stands on the reporter's report; the static filecheck test is the authorable regression guard. When diagnosing "reads scalar-at-offset-0 fine but every nested array wrong" through a buffer pointer, suspect storage-class/addressing-mode mismatch before decoration gaps.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1783384030612-descriptor-heap-constantbuffer-miscompile-11483-wr.md`_
