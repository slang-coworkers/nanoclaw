---
title: "Vulkan PSB OpPtrAccessChain negative Element wraps +4GB on NVIDIA without 64-bit indexing; lavapipe/glslang differ"
type: learning
topic: slang-compiler
source: learnings/1793805740394-vulkan-psb-opptraccesschain-negative-element-wraps.md
---

# Vulkan PSB OpPtrAccessChain negative Element wraps +4GB on NVIDIA without 64-bit indexing; lavapipe/glslang differ

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793804583552-vmbsa4
written_at: 2026-11-04T15:22:20.394Z
---

# Vulkan PSB OpPtrAccessChain negative Element wraps +4GB on NVIDIA without 64-bit indexing; lavapipe/glslang differ

The NVIDIA Vulkan driver gives a wrong address for a negative OpPtrAccessChain step on a PhysicalStorageBuffer pointer. The driver computes low32(Element×ArrayStride), zero-extends it, and adds it to the 64-bit base, so `Ptr<uint>(base) + (-1)` gives base + 0xFFFFFFFC. Verified on L40S, Linux, driver 595.91.07 at Slang 3da6f63 (shader-slang/slang#14305; the reporter saw the same on RTX 5090 / Windows 621.01). It is correct only when the Shader64BitIndexingEXT execution mode or VK_PIPELINE_CREATE_2_64_BIT_INDEXING_BIT_EXT is set; enabling the device feature alone does not help.
- lavapipe (Mesa 1.3.230) sign-extends, so it gives the correct result for the same SPIR-V.
- glslang compiles GL_EXT_buffer_reference2 `p + i` to ConvertPtrToU/IMul/IAdd/ConvertUToPtr, not to an access chain, so that shader is correct on NVIDIA.
- slang-test -vk reproduces the bug, because slang-rhi never enables 64-bit indexing. `[Shader64BitIndexing]` still takes effect under slang-test even though the feature is not enabled.
- Separate compiler bug: core.meta.slang `operator-` for Ptr is `__getOffsetPtr(value, -offset)`, so on CUDA and CPU `p - uint(1)` moves forward by 0xFFFFFFFF elements.

To build the glslang standalone binary and spirv-dis/spirv-val from the slang build dir: `ninja -f build-Release.ninja glslang-standalone spirv-dis spirv-val`. The binaries are at build/external/glslang/StandAlone/Release/glslang and build/external/spirv-tools/tools/Release/.

A raw Vulkan host for lavapipe: set VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/lvp_icd.x86_64.json. lavapipe in this container has no maintenance5, so do not chain VkPipelineCreateFlags2CreateInfo. Scratch files: /workspace/agent/scratch-14305/ (slang-triager).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793805740394-vulkan-psb-opptraccesschain-negative-element-wraps.md`_
