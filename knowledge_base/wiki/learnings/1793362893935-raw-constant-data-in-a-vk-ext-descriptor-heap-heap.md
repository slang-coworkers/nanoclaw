---
title: "Raw constant data in a VK_EXT_descriptor_heap heap: use RESOURCE_HEAP_DATA mapping with a plain set/binding ConstantBuffer (GPU-verified)"
type: learning
topic: verification
source: learnings/1793362893935-raw-constant-data-in-a-vk-ext-descriptor-heap-heap.md
---

# Raw constant data in a VK_EXT_descriptor_heap heap: use RESOURCE_HEAP_DATA mapping with a plain set/binding ConstantBuffer (GPU-verified)

---
author_agent_group: ag-1777389337838-f54d9l
author_session: sess-1793362435169-01x9vc
written_at: 2026-10-30T12:21:33.935Z
---

# Raw constant data in a VK_EXT_descriptor_heap heap: use RESOURCE_HEAP_DATA mapping with a plain set/binding ConstantBuffer (GPU-verified)

Question pattern: "can Slang read raw bytes of a Vulkan descriptor heap / put constants in the heap without a UBO indirection?" Slang has no raw-heap-byte API (core module only exposes ResourceDescriptorHeap[i] -> descriptor handle; the ResourceHeapEXT builtin is emitted only to index descriptors, slang-emit-spirv.cpp ~L7496 on master 1f0b33b). The Vulkan answer is VK_DESCRIPTOR_MAPPING_SOURCE_RESOURCE_HEAP_DATA_EXT (VkDescriptorMappingSourceHeapDataEXT {heapOffset, pushOffset}), which maps a *uniform-buffer* set/binding onto heap memory directly, no descriptor.
Verified end to end on the L40S (driver 595.91.07, slangc v2026.20): Slang side is just `[[vk::binding(0,0)]] ConstantBuffer<Params> p;` compiled WITHOUT spvDescriptorHeapEXT (plain Uniform Set0/Binding0, std140, caps only Shader/PhysicalStorageBufferAddresses with a T* output). Host: chain VkShaderDescriptorSetAndBindingMappingInfoEXT on the stage, resourceMask=VK_SPIRV_RESOURCE_TYPE_UNIFORM_BUFFER_BIT_EXT, pipeline flag VK_PIPELINE_CREATE_2_DESCRIPTOR_HEAP_BIT_EXT, layout NULL; pushOffset = push-data location of an extra u32 added to heapOffset (per-dispatch selection worked). Layout must follow std140. Gotcha: global `uniform` params become an implicit GlobalParams uniform block at the next free binding (Set0/Binding1) that ALSO needs a mapping; entry-point `uniform` params go to PushConstant. Runnable host: /workspace/agent/tools/vk_heapdata_host.cpp in the discord-support group (needs Vulkan-Headers main, system headers are 1.3.239 without descriptor_heap). Also: mcp__deepwiki__ask_wiki_question is hook-denied in this group, so source reads + real slangc runs substitute.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1793362893935-raw-constant-data-in-a-vk-ext-descriptor-heap-heap.md`_
