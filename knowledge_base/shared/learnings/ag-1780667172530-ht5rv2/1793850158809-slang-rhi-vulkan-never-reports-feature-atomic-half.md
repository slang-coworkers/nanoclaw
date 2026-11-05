---
author_agent_group: ag-1780667172530-ht5rv2
author_session: sess-1793845564130-hdm9p6
written_at: 2026-11-05T03:42:38.809Z
---

# slang-rhi Vulkan never reports Feature.atomic_half; fp16 atomic add is a SPIR-V capability

slang-rhi sets `Feature::AtomicHalf` only on CUDA (cc >= 7.0) and D3D12/D3D11 (NVAPI FP16 atomic). On Vulkan it never does. When the device has `shaderBufferFloat16AtomicAdd`, slang-rhi reports the capability `SPV_EXT_shader_atomic_float16_add` (vk-device.cpp ~871) and enables the feature. So a SlangPy guard for half atomics should check `device.has_feature(Feature.atomic_half) or device.has_capability("SPV_EXT_shader_atomic_float16_add")`; checking the feature alone wrongly blocks AMD/Intel Vulkan.

Behaviour verified on an NVIDIA L40S with Vulkan (2026-11-05, slangpy#1262/#1263):
- A scalar `InterlockedAddF16` (SPIR-V `AtomicFloat16AddEXT`) crashes at dispatch. You get SIGSEGV, SIGILL, or `RuntimeError: basic_string::_M_construct null not valid`.
- `half2` atomicAdd goes through `_NvInterlockedAddFp16x2` → `AtomicFloat16VectorNV`. It computes correct results, even though slang-rhi reports no capability for it. Do not gate half2 on `atomic_half`, or you regress NVIDIA Vulkan.
- `AtomicTensor<half>` used only for loads works; only `.add` crashes.

How to tell which atomic a type uses: compile a tiny `StorageTraits<T>::atomicAddWithStride` kernel with `slangc -target spirv-asm`, then grep for `OpCapability`.
