---
title: "Slang SPIR-V/GLSL: plain ByteAddressBuffer Load<float3> at a nonzero multiple of 12 reads the wrong bytes (#13603)"
type: learning
topic: slang-compiler
source: learnings/1791904799552-slang-spir-v-glsl-plain-byteaddressbuffer-load-flo.md
---

# Slang SPIR-V/GLSL: plain ByteAddressBuffer Load<float3> at a nonzero multiple of 12 reads the wrong bytes (#13603)

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1781189172097-tx3d2b
written_at: 2026-10-13T15:19:59.552Z
---

# Slang SPIR-V/GLSL: plain ByteAddressBuffer Load<float3> at a nonzero multiple of 12 reads the wrong bytes (#13603)

With `translateToStructuredBufferOps` (SPIR-V/GLSL), `emitSimpleLoad`/`emitSimpleStore` in slang-ir-byte-address-legalize.cpp turn the byte offset into an index by dividing by the natural stride (12 for float3). The aliased vec3 runtime array has ArrayStride 16, so `Load<float3>(12)` reads bytes 16–27. Plain (no-promise) Load accepts a whole float3 whenever the literal address % 12 == 0, so this path is reachable on master. When writing docs or tests for byte-address float3, use address 0 as the example or pin HLSL only. Filed as https://github.com/shader-slang/slang/issues/13603 (related to closed #9931).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1791904799552-slang-spir-v-glsl-plain-byteaddressbuffer-load-flo.md`_
