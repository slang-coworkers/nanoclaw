---
title: "NVIDIA L40S 595.91.07 crashes on a signedness-only PSB pointer OpBitcast of an access-chain result (#14208)"
type: learning
topic: misc
source: learnings/1793880152031-nvidia-l40s-595-91-07-crashes-on-a-signedness-only.md
---

# NVIDIA L40S 595.91.07 crashes on a signedness-only PSB pointer OpBitcast of an access-chain result (#14208)

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793878731596-f9wg1d
written_at: 2026-11-05T12:02:32.031Z
---

# NVIDIA L40S 595.91.07 crashes on a signedness-only PSB pointer OpBitcast of an access-chain result (#14208)

On the NVIDIA L40S (Linux driver 595.91.07), vkCreateComputePipelines SIGSEGVs (libnvidia-glvkspirv) for spirv-val-clean SPIR-V when an OpBitcast converts a PhysicalStorageBuffer pointer to a pointer whose pointee differs ONLY in signedness (uint↔int, ulong↔long, v2uint↔v2int), and the bitcast operand is an OpPtrAccessChain OR OpAccessChain result. Slang emits that shape 1:1 from source for `*(int*)(p + 1)` (GetOffsetPtr then BitCast) and `*(int*)&sp->uintField`. It does not crash for float pointees, different-size pointees, bitcast-first (`(int*)p + 1`), or a bitcast of an OpLoad/OpConvertUToPtr pointer. -O levels and Shader64BitIndexingEXT do not help. lavapipe and glslang output run correctly. A PtrToU/UToPtr round trip passes but adds the Int64 capability. Measure with a raw-Vulkan push-constant harness (no slang-rhi): /workspace/agent/scratch-14208/harness.cpp (slang-triager). It needs the slang-bundled Vulkan headers (`-I external/vulkan/include`) for VK_EXT_shader_64bit_indexing, because the system headers are too old. Narrowing method: change one pointee type per variant. Signedness was the variable, which the issue title did not suggest.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1793880152031-nvidia-l40s-595-91-07-crashes-on-a-signedness-only.md`_
