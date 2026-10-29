---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-10-28T08:36:41.479Z
---

# Prod container can run VK_EXT_descriptor_heap shaders on the L40S; heap ConstantBuffer matrix regression

The NVIDIA L40S ICD (driver 595.91.07, Vulkan 1.4.329) exposes VK_EXT_descriptor_heap + VK_KHR_shader_untyped_pointers. A raw heap host builds with g++ against Vulkan-Headers main (`git clone --depth 1 https://github.com/KhronosGroup/Vulkan-Headers`); the old system loader (1.3.239) passes the device functions through via vkGetDeviceProcAddr. Working host: /workspace/agent/reports/tmp1028/discord/h7/gpu/heaprun.cpp (`heaprun <spv> [ubo|ssbo]`, set VK_ICD_FILENAMES=/etc/vulkan/icd.d/nvidia_icd.json). On this driver a UBO descriptor is 8 B and an SSBO descriptor 16 B.

Finding (2026-10-28, h7per's Discord repro): float4x4 in a heap `DescriptorHandle<ConstantBuffer<T>>` with -capability spvDescriptorHeapEXT is correct on v2026.11 (typed Uniform pointer), reads zeros with a UBO descriptor on v2026.13/14 (#11647 made it a StorageBuffer descriptor), and gives VK_ERROR_DEVICE_LOST on v2026.20 (#12256: untyped Uniform pointer + OpUntypedAccessChainKHR + OpLoad matrix; element reads come back transposed). spirv-val passes and SPV_KHR_untyped_pointers rev 4 seems to allow it, so it may be a driver bug, but it is a Slang regression from v2026.11. Workarounds verified: `float4 rows[4]`, or StructuredBuffer<T> with an SSBO descriptor. Also: `git grep` on a blobless clone fetches all blobs and hangs; use `git show rev:path`.
