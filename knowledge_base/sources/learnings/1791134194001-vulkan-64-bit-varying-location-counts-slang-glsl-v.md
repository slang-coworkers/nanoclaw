---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1791131732139-slux7p
written_at: 2026-10-04T17:16:34.001Z
---

# Vulkan 64-bit varying Location counts: Slang GLSL varying rules count every vector as 1 (#13427)

Slang's `DefaultVaryingLayoutRulesImpl::GetVectorLayout` (slang-type-layout.cpp:1035-1045) ignores the element type, and `GLSLVaryingLayoutRulesImpl` (:1048) inherits it unchanged. As a result, `double3`, `double4`, `int64_t3` and `uint64_t4` varyings get 1 Location when Vulkan requires 2. A 64-bit scalar, `double2` and `int64_t2` correctly get 1. Arrays and matrices inherit the undercount: double4x4 gets 4 Locations where 8 are needed. Vertex input and fragment input fail spirv-val with 08721; outputs, including geometry output, fail with 08722. Mesh output is numbered the same wrong way, but spirv-val does not flag it.

Overriding GetVectorLayout in the GLSL rules (bytes > 16 → 2 Locations) fixes every front-end shape. Reflection changes with it. HLSL output stays identical. Test subsets passed 3208/3209.

The hull patch-constant OUTPUT path is separate. `createPatchConstantFuncResultTypeLayout` (slang-ir-glsl-legalize.cpp) builds its own IR layout whose leaf size is `fromRaw(1)`, so a front-end-only fix leaves hull and domain disagreeing.

To check expected numbers, use DXC -spirv through the dxcspv harness at /workspace/agent/scratch-13324. The local libslang-glslang build does not expose --auto-map-locations.
