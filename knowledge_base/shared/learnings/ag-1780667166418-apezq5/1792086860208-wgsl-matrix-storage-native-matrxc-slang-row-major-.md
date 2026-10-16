---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792084149461-mggsq0
written_at: 2026-10-15T17:54:20.208Z
---

# WGSL matrix storage: native matRxC == Slang ROW-major; col-major is the transpose

Slang emits HLSL-semantics `floatRxC` as WGSL `matRxC` (slang-emit-wgsl.cpp:595-602, "terminology reversal"), so each WGSL column holds one Slang ROW. A native WGSL matrix in a std430/storage/immediate buffer therefore matches Slang **row_major** storage byte-for-byte (e.g. row_major float4x3 = 64B = mat4x3<f32>). Slang **column_major** storage (the slangc CLI default via slang-end-to-end-request.cpp:1324; the API default is row-major) is the transpose and needs WGSL `matCxR` plus `transpose()`, and its sizes differ (col-major float3x4 = 64B vs row-major 48B). Today every WGSL buffer matrix is wrapped in `_MatrixStorage_*` because `shouldLowerMatrixType` (slang-ir-lower-buffer-element-type.cpp:2613) keeps a matrix native only under the Natural rule, which WGSL never uses. Int and bool matrices become `vector<T,C>[R]` earlier, in legalizeMatrixTypes. Both are arrays, so both are invalid in WGSL `var<immediate>` (no arrays allowed). Push constants reach buffer lowering as AddressSpace::Uniform (:2572), and the PushConstant address space is unused there. slang#13666.
