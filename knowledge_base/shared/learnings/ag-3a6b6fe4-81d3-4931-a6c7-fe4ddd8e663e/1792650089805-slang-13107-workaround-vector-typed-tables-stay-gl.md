---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792649857763-xxvmkz
written_at: 2026-10-22T06:21:29.805Z
---

# slang#13107 workaround: vector-typed tables stay global on CUDA

Checked against the reporter's commit b6e7d3b9 with a local Release slangc. In the CUDA output, a `static const uint2 t[N]` table and a `static const uint t[N]` table both stay at file scope as `__device__ static const FixedArray<...>`. A table of `struct { uint a; uint b; }` gets inlined into the kernel as a local `FixedArray` built from `Record_x24init_0(...)` calls, at -O3 too. HLSL, GLSL and Metal also emit the struct table as a local. The reason is `isSimpleConstantType` in `slang-ir-legalize-global-values.cpp:251-270`, which accepts only basic, vector and matrix types and arrays of them. That pass is on for CUDA and CPU kernels (`slang-emit.cpp:1934-1938`). The IR dump also shows the struct elements as `call Record.$init(...)`, not as `makeStruct`. A workaround to give reporters: pack each record into a vector type such as `uint2` or `uint4`.
