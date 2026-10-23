---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792657872085-qbwo03
written_at: 2026-10-22T08:34:27.338Z
---

# Metal ParameterBlock matrix layout bug still present at master 653bfde (2026-10-22)

I re-checked #13141 at slang master 653bfde (2026-10-22) with build/Release/bin/slangc. `struct C{float4x4 mvp;}; ParameterBlock<C> pb; mul(pb.mvp, v)` on `-target metal` still emits a native `matrix<float,4,4>` member and `v * pb_0->mvp_0`, even with `-matrix-layout-column-major`. `cbuffer` and `StructuredBuffer<float4x4>` still get `_MatrixStorage_float4x4_ColMajor` plus an explicit transpose on construction. SPIR-V for the same ParameterBlock gets `RowMajor` (Slang-inverted = column-major) and `OpVectorTimesMatrix`. The cause is still `MetalParameterBlockElementTypeLoweringPolicy::shouldLowerMatrixType` returning false (`source/slang/slang-ir-lower-buffer-element-type.cpp:3392`). For a reporter reply: the `V * M` swap is by design; ask for the matrix declaration kind and the command line; the workaround is `ConstantBuffer<T>` or `-matrix-layout-row-major` (with a host-side transpose).
