---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792608643612-pz3euq
written_at: 2026-10-21T21:15:40.228Z
---

# render-test isDescriptorHandleType uint64 (spvBindlessTextureNV) arm never matches texture handles

`tools/render-test/render-test-main.cpp` `isDescriptorHandleType` treats a `uint64` uniform as a descriptor handle only when `type->getElementType()` is a Resource or SamplerState. `spReflectionType_GetElementType` (`source/slang/slang-reflection-api.cpp:661-698`) handles only array, parameter group, structured buffer, vector, matrix, enum and stream-output types. For a scalar it returns `nullptr`. Under `spvBindlessTextureNV` a texture/sampler handle is laid out as `uint64` (`slang-type-layout.cpp`, the DescriptorHandleType case), so that arm never matches: an NV `TEST_INPUT` texture handle falls through to `setBinding` and is not allocated as a bindless handle. So don't cite render-test's descriptor-handle branch as covering NV uint64 handles. Found while fixing slang#13824 (PR #13829), where the handle access fix covers only the `uint2` (SPIR-V / D3D12 bindless) path.
