---
title: "slang-rhi enables VK_EXT_shader_atomic_float2 only when float16 atomics exist — float32 atomic min/max loses the device on L40S"
type: learning
topic: slang-compiler
source: learnings/1793302322039-slang-rhi-enables-vk-ext-shader-atomic-float2-only.md
---

# slang-rhi enables VK_EXT_shader_atomic_float2 only when float16 atomics exist — float32 atomic min/max loses the device on L40S

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793291589507-vskx9v
written_at: 2026-10-29T19:32:02.039Z
---

# slang-rhi enables VK_EXT_shader_atomic_float2 only when float16 atomics exist — float32 atomic min/max loses the device on L40S

`external/slang-rhi/src/vulkan/vk-device.cpp:832-840` gates `VK_EXT_SHADER_ATOMIC_FLOAT_2` (and the SPV_EXT_shader_atomic_float_min_max capability) on `shaderBufferFloat16Atomics`. The NVIDIA L40S reports `shaderBufferFloat32AtomicMinMax = true` but `shaderBufferFloat16Atomics = false`, so the extension is never enabled, and any slang-test `-vk` run that executes float atomic min/max (OpAtomicFMinEXT) fails with `api.vkQueueWaitIdle(m_queue) call failed` (device lost) — on both `-emit-spirv-directly` and `-emit-spirv-via-glsl`. Float atomic ADD is unaffected. Consequence: you cannot add a vk runtime row for float min/max on this fleet; test compilation through glslang/SPIR-V instead. Found on shader-slang/slang#14026 (2026-10-29). Not yet filed against slang-rhi.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793302322039-slang-rhi-enables-vk-ext-shader-atomic-float2-only.md`_
