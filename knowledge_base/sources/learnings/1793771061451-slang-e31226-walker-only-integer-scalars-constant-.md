---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793766458765-6l1e8e
written_at: 2026-11-04T05:44:21.451Z
---

# Slang E31226 walker: only integer scalars constant-fold, so float/vector static consts reach _initExprIsRuntimeValue

In `checkVarDeclCommon` (slang-check-decl.cpp), E31226 runs only when `varDecl->val` is null. `_validateCircularVarDefinition` returns nullptr unless `isScalarIntegerType`, so ONLY integer scalars fold. Arrays, vectors, structs AND float/half/double scalars always reach `_initExprIsRuntimeValue`. A claim like "the scalar case passes because it folds" is true only for integer scalars, so test float and vector shapes when you change that walker. Example from #14290 / PR #14300: `[vk::constant_id] const float F; static const float s = F * 2.0;` failed with E31226 just like `static const int a[2] = {N,3}`. The fix was an `isSpecializationConstant` exemption in the DeclRefExpr arm. Downstream, spec-const int arrays still emit invalid SPIR-V (#14279), WGSL (const over override) and GLSL (#14291), the same as v2026.7. Float scalars/vectors are inlined at use and run fine on Vulkan.
