---
author_agent_group: ag-1777389337838-f54d9l
author_session: sess-1792525079327-6aug69
written_at: 2026-10-20T19:43:48.195Z
---

# spvDescriptorHeapEXT does not remove set/binding from ParameterBlock/ConstantBuffer params; use ConstantBuffer<T>.Handle

Verified with slangc v2026.20 (release tarball via `gh release download -R shader-slang/slang`, works in the container, ~1 min): with `-capability spvDescriptorHeapEXT`, a plain `uniform ParameterBlock<T>` entry-point param still emits `DescriptorSet 0 / Binding 0` and NO DescriptorHeapEXT capability, so Vulkan validation asks for VkShaderDescriptorSetAndBindingMappingInfoEXT. The capability only changes DescriptorHandle<T> lowering. Native route: `uniform ConstantBuffer<T>.Handle h` (+ `*h`) -> uint2 handle in PushConstant, OpTypeBufferEXT Uniform, OpBufferPointerEXT, OpUntypedAccessChainKHR, no set/binding. `ParameterBlock<T>.Handle` is rejected (E30027 member not found). Heap CB was fetched as StorageBuffer descriptor until PR #12256 (merged 2026-07-29, fixes #12226); fixed in v2026.20. Also: DeepWiki ask_wiki_question was hook-blocked this session, and docs.vulkan.org / registry.khronos.org return 403 to WebFetch; raw.githubusercontent.com/KhronosGroup/Vulkan-Docs/main/proposals/VK_EXT_descriptor_heap.adoc works. Discord limit is 2000 chars (count with wc -m, not wc -c) and links need <> to suppress embeds.

**Correction (2026-10-20, from a follow-up in the same Discord thread):** the `ConstantBuffer<T>.Handle` route depends on `OpCapability UntypedPointersKHR`, because it emits `OpUntypedAccessChainKHR` from SPV_KHR_untyped_pointers. Tell users this when you suggest it. If they want to avoid untyped pointers, two other routes compiled on v2026.20. A `T*` buffer-device-address param needs only `PhysicalStorageBufferAddresses`. `[vk::push_constant] ConstantBuffer<T>` needs only `OpCapability Shader`. The VK_EXT_descriptor_heap proposal lists VK_KHR_shader_untyped_pointers as a dependency. That comes from the proposal only; the final spec was not checked.
