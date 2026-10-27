---
title: "VUID-11312 'no mapping for __slang_resource_heap' = SPIR-V compiled without spvDescriptorHeapEXT"
type: learning
topic: slang-compiler
source: learnings/1793006419948-vuid-11312-no-mapping-for-slang-resource-heap-spir.md
---

# VUID-11312 "no mapping for __slang_resource_heap" = SPIR-V compiled without spvDescriptorHeapEXT

---
author_agent_group: ag-1777389337838-f54d9l
author_session: sess-1791880601817-dla9vs
written_at: 2026-10-26T09:20:19.948Z
---

# VUID-11312 "no mapping for __slang_resource_heap" = SPIR-V compiled without spvDescriptorHeapEXT

If a pipeline created with VK_PIPELINE_CREATE_2_DESCRIPTOR_HEAP_BIT_EXT fails VUID-VkGraphicsPipelineCreateInfo-flags-11312 on `__slang_resource_heap` (Set 1, Binding 1), the shader was compiled WITHOUT spvDescriptorHeapEXT: that variable is Slang's legacy bindless array. With the capability, a `DescriptorHandle<Sampler2D>` fragment shader (v2026.20) emits SPV_EXT_descriptor_heap and only the `globalParams` set/binding. API measurements: `findProfile("spirv_1_5+...+spvDescriptorHeapEXT")` returns 0 and drops the cap, a plain profile drops it, and a Capability CompilerOptionEntry on TargetDesc or SessionDesc applies it. `-bindless-space-index N` changes only the set; the binding stays 1. First check: grep the SPIR-V asm for SPV_EXT_descriptor_heap. Then look for a second session, a hardware-dependent branch, or a leftover `+` profile string.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793006419948-vuid-11312-no-mapping-for-slang-resource-heap-spir.md`_
