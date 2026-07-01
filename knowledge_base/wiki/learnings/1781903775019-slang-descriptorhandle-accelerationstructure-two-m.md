---
title: "Slang DescriptorHandle<AccelerationStructure>: two models, heap vs plain bindless"
type: learning
topic: slang-compiler
source: learnings/1781903775019-slang-descriptorhandle-accelerationstructure-two-m.md
---

# Slang DescriptorHandle<AccelerationStructure>: two models, heap vs plain bindless

When a user reports `DescriptorHandle<RaytracingAccelerationStructure>` crashing (`VK_ERROR_DEVICE_LOST`) on SPIR-V/Vulkan, FIRST ask whether they compile with `-capability spvDescriptorHeapEXT`. There are two distinct lowerings and conflating them gives wrong advice:

**(a) Plain bindless `DescriptorHandle`** (no `spvDescriptorHeapEXT`; user declares `__DynamicResource<...> __resource_descriptor_heap[]` arrays themselves, or just relies on the default). Here `defaultGetDescriptorFromHandle` for AS is special-cased: AS is EXCLUDED from the `__slang_resource_heap` binding array and the handle is treated as a 64-bit GPU device address, lowered to `OpConvertUToAccelerationStructureKHR`. So you pass the `vkGetAccelerationStructureDeviceAddressKHR` value. Handle is a `uint2`, so the full 64 bits must round-trip (host must fill both lanes, not just `.x`). Authoritative proof: `tests/language-feature/descriptor-handle/desc-handle-default.slang` — plain `-target spirv`, asserts `ACCELERATION_STRUCTURE-NOT: ...Binding 8` and `ACCELERATION_STRUCTURE: OpConvertUToAccelerationStructureKHR`.

**(b) `spvDescriptorHeapEXT`**: AS handle is a heap INDEX; Slang loads a uint64 device address FROM the heap slot at that index, then converts. Two recent fixes here — #10671→PR #11209 (merged 2026-06-03, was emitting invalid SPIR-V → DEVICE_LOST) and #11231→PR #11494 (merged 2026-06-16, AS heap index ≥ 1 mis-indexed unless `-spirv-resource-heap-stride` matched sizeof(uint64)=8; post-fix the heap entry is typed uint64). AS heap slots must hold the device address; stride < 8 errors E57005.

Both models emit `OpConvertUToAccelerationStructureKHR` at the end, but the handle means different things (index vs address). Don't anchor on the heap path without confirming the capability.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1781903775019-slang-descriptorhandle-accelerationstructure-two-m.md`_
