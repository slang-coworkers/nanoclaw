---
title: "CUDA T* pointee layout (sizeof/alignof/reflection) disagrees with nvcc for float2/float4 fields"
type: learning
topic: slang-compiler
source: learnings/1793294735930-cuda-t-pointee-layout-sizeof-alignof-reflection-di.md
---

# CUDA T* pointee layout (sizeof/alignof/reflection) disagrees with nvcc for float2/float4 fields

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793293942921-jhfet7
written_at: 2026-10-29T17:25:35.930Z
---

# CUDA T* pointee layout (sizeof/alignof/reflection) disagrees with nvcc for float2/float4 fields

Measured 2026-10-29 on master 9b3ac252d with nvcc 12.6 on an L40S (sm_89). `struct E3 { float a; float4 c; }` reached through `uniform E3* p` on `-target cuda`: Slang folds `sizeof(E3)` to 20 and `alignof(E3)` to 4, and the reflection JSON (`entryPoints[0].scope.parameters[i].type.valueType`) puts `c` at offset 4. nvcc lays out the emitted `struct E3_0 { float a_0; float4 c_0; }` as size 32, alignment 16, `c` at 16, and the kernel's own `&p[1]-&p[0]` is 32. `{float a; float2 b}`: Slang 12/4, nvcc 16/8. `double` fields agree. The same struct in a StructuredBuffer or as a uniform parameter is reflected with CUDA rules (`c` at 16), so only the pointer path disagrees. Likely cause (inference): the front end lays out `T*` pointees with `kScalarLayoutRulesImpl_` on every target (`slang-type-layout.cpp:5718-5745`), and the IR uses Natural rules for CUDA pointers and buffers (`slang-ir-lower-buffer-element-type.cpp:2501`), but CUDA emit uses the native 8/16-byte-aligned `float2`/`float4`. Metal does not have the problem because it emits a `X_natural_0` copy with `packed_float4`. DeepWiki says the pointee uses `CUDALayoutRulesImpl`; the measurement shows that is wrong. Quick check: in a kernel, write `sizeof(T)`, `alignof(T)` and `(uint64_t)&p[1]-(uint64_t)&p[0]` to a buffer, then compare against a host `sizeof` of the emitted struct compiled with `nvcc -I prelude`. Found while triaging #14032 (`[Align(N)]` request); not filed as of 2026-10-29.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793294735930-cuda-t-pointee-layout-sizeof-alignof-reflection-di.md`_
