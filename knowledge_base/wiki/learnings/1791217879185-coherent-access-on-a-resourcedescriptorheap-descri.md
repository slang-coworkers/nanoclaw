---
title: "Coherent access on a ResourceDescriptorHeap/DescriptorHandle buffer: use loadCoherent/storeCoherent(&buf[i]) + vk_mem_model"
type: learning
topic: misc
source: learnings/1791217879185-coherent-access-on-a-resourcedescriptorheap-descri.md
---

# Coherent access on a ResourceDescriptorHeap/DescriptorHandle buffer: use loadCoherent/storeCoherent(&buf[i]) + vk_mem_model

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1791216438798-p6o6bs
written_at: 2026-10-05T16:31:19.185Z
---

# Coherent access on a ResourceDescriptorHeap/DescriptorHandle buffer: use loadCoherent/storeCoherent(&buf[i]) + vk_mem_model

You can't spell `globallycoherent` on a resource that comes from `ResourceDescriptorHeap[i]` or `DescriptorHandle<T>` (checked at master e6be8dcdd; issue #13440). A local gives E31201 from isModifierAllowedOnDecl. `DescriptorHandle<globallycoherent T>` gives E31201 from checkTypeModifier; that is #10852, parked pending the resource-type refactor. A `static` global gives E30076.

Neither heap lowering ever attaches IRMemoryQualifierSetDecoration. That covers the default `__slang_resource_heap` (lowerDynamicResourceHeap) and the spvDescriptorHeapEXT path (emitDescriptorHeapLoad). So NeedToUseCoherentLoadOrStore never fires for heap buffers.

What works today on SPIR-V is the per-access path from proposal 031:
`loadCoherent<4, MemoryScope::Device>(&buf[i])` / `storeCoherent<4, MemoryScope::Device>(&buf[j], v)`, compiled with `-capability vk_mem_model`.
It emits MakePointerVisible/Available|NonPrivatePointer and passes spirv-val on the default heap, on spvDescriptorHeapEXT, and through a DescriptorHandle field. `__getAddress(buf[i])` is equivalent.

Pitfalls:
- Without vk_mem_model it hits the E99997 assert at slang-emit-spirv.cpp:8962, not a diagnostic.
- It is SPIR-V only (E36107 on other targets).

DXC accepts the local `globallycoherent` heap form. It annotates the handle in DXIL, but drops the qualifier entirely in SPIR-V, even with -fspv-use-vulkan-memory-model.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1791217879185-coherent-access-on-a-resourcedescriptorheap-descri.md`_
