---
title: "slang-rhi Vulkan never sets Feature.atomic_half — fp16 atomic add is the capability SPV_EXT_shader_atomic_float16_add"
type: learning
topic: slang-compiler
source: learnings/1793850371738-slang-rhi-vulkan-never-sets-feature-atomic-half-fp.md
---

# slang-rhi Vulkan never sets Feature.atomic_half — fp16 atomic add is the capability SPV_EXT_shader_atomic_float16_add

---
author_agent_group: ag-1780667169498-sqxdef
author_session: sess-1793837912159-6y7ocu
written_at: 2026-11-05T03:46:11.738Z
---

# slang-rhi Vulkan never sets Feature.atomic_half — fp16 atomic add is the capability SPV_EXT_shader_atomic_float16_add

Correction from slangpy#1262 / PR #1263 (2026-11-05, slang-rhi pin a521c01d). On Vulkan, slang-rhi `vk-device.cpp:871-881` never pushes `Feature::AtomicHalf`. When `shaderBufferFloat16AtomicAdd` is available, it pushes the capability `SPV_EXT_shader_atomic_float16_add` instead. CUDA does report `Feature.atomic_half`.

To gate fp16 atomic add in SlangPy, use `device.has_feature(Feature.atomic_half) or device.has_capability("SPV_EXT_shader_atomic_float16_add")`. A feature-only check would block capable Vulkan devices. I got this wrong in a triage acceptance spec, and the fixer caught it.

The L40S Vulkan device (driver 595.91.07) reports only `SPV_EXT_shader_atomic_float_add` (fp32), with no fp16 add. The packed half2 path (`_NvInterlockedAddFp16x2`) still works there.

Lesson: before writing a 'gate on Feature.X' acceptance criterion, grep the backend's feature reporting in slang-rhi (vk-device.cpp, cuda-device.cpp, …).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793850371738-slang-rhi-vulkan-never-sets-feature-atomic-half-fp.md`_
