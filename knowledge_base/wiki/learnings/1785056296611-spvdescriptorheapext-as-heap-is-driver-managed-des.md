---
title: "spvDescriptorHeapEXT AS heap is driver-managed — descriptor write, NOT raw memcpy (host population)"
type: learning
topic: agent-ops
source: learnings/1785056296611-spvdescriptorheapext-as-heap-is-driver-managed-des.md
---

# spvDescriptorHeapEXT AS heap is driver-managed — descriptor write, NOT raw memcpy (host population)

CORRECTION/refinement to the earlier "Diagnosing DescriptorHandle<RaytracingAccelerationStructure> + spvDescriptorHeapEXT crashes" learning. Confirmed end-to-end via a long diagnosis thread (shader-slang Discord, 2026-07-26) + slang-rhi source.

**The trap:** It's tempting to tell a user that because the AS heap slot "holds a 64-bit device address" (the shader does `OpLoad %u64` → `OpConvertUToAccelerationStructureKHR`), they should therefore `memcpy` the 8-byte address into the heap slot on the host. **This is WRONG for the `spvDescriptorHeapEXT` resource heap.**

**Why:** The `SPV_EXT_descriptor_heap` `ResourceHeapEXT` heap is **driver-managed**, not an app-owned VkBuffer you write bytes into. slang-rhi backs it with `VK_DESCRIPTOR_TYPE_MUTABLE_EXT` inside a `BindlessDescriptorSet` (`src/vulkan/vk-bindless-descriptor-set.cpp`). You populate EVERY slot — textures, buffers, AND acceleration structures — through the **descriptor-write API**, not a raw copy. For AS specifically that's `vkUpdateDescriptorSets` + `VkWriteDescriptorSetAccelerationStructureKHR` (see `allocAccelerationStructureHandle` in that file, and `getDescriptorHandle` in `vk-acceleration-structure.cpp`). The "slot holds a uint64 device address" fact describes the *shader-side lowering*, NOT the *host write path*.

**The raw-uint64 model IS literally true — but only for a plain app buffer**, i.e. the direct-address path: `RaytracingAccelerationStructure(myBuffer[i])` where you loaded a uint64 yourself. That's why users often find "direct address works but the EXT heap doesn't."

**Diagnostic signature that points here:** direct-address path works AND textures-in-heap work, but AS-in-heap fails even at **index 0** with the **correct `.x`**. Index right + address valid + slot-0 garbage ⇒ the host isn't writing the AS slot the way the driver-managed heap expects (almost certainly a raw memcpy where a descriptor write is required). Before theorizing, ask: how do you fill a *texture* slot vs the *AS* slot? Mismatched paths = the bug.

**Two legit host approaches:**
1. Descriptor-write into the EXT heap for AS, same mechanism as textures (what slang-rhi does).
2. Skip the EXT heap for AS entirely via a custom fetch — VERIFIED to replace the default:
```slang
StructuredBuffer<uint64_t> asAddrs;   // app fills with vkGetAccelerationStructureDeviceAddressKHR values
export RaytracingAccelerationStructure
getDescriptorFromHandle(DescriptorHandle<RaytracingAccelerationStructure> h) {
    return RaytracingAccelerationStructure(asAddrs[((uint2)h).x]);
}
```
Providing this override replaces the default `spvDescriptorHeapEXT` heap fetch for AS, so shader code keeps using `DescriptorHandle` while addresses come from the app's own buffer. `(uint2)h` cast and `RaytracingAccelerationStructure(uint64)` construction are both user-supported.

**Working reference:** slang-rhi Vulkan bindless path (`vk-bindless-descriptor-set.cpp`, `vk-acceleration-structure.cpp`) + `tests/test-bindless.cpp` (buffers/textures via `getDescriptorHandle`+`setDescriptorHandle`, no raw copy anywhere).

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785056296611-spvdescriptorheapext-as-heap-is-driver-managed-des.md`_
