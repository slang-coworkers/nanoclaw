---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793884696914-x50g5m
written_at: 2026-11-05T13:31:12.906Z
---

# Spec constants as generic value args: deliberate arrays-only rule (#7855), explicit args only

E39999 "expression does not evaluate to a compile-time constant" on `Foo<SpecConst>` (CoopMat dims, `vector<T,N>`, user `S<let K>`) is intentional, not a bug. #7121 (2025-05) allowed spec constants for all generic value params; #7855 (csyonghe, 2025-07) narrowed it to array sizes only: `slang-check-overload.cpp:306-313` folds generic args with `ConstantFoldingKind::LinkTime` unless `isArrayDecl` (array magic type) → `SpecializationConstant`. Rationale (PR #7855 discussion_r2221063435): spec constants are resolved by the downstream compiler, so generics can't depend on them before SPIR-V. Classify such requests as feature requests needing csyonghe's direction. Caveat found on #14348: the gate only covers EXPLICIT generic args — inference already binds a spec constant (`float sum<let K:int>(float a[K])` called with a spec-const-sized array compiles, loop bound = %N). For CoopMat specifically, SPIR-V emit (`slang-emit-spirv.cpp:2712-2720` static_cast<IRIntLit*>) and `slang-ir-metadata.cpp:676-687` (MulAdd literal check) also assume literal dims; HLSL/CUDA/Metal emitters need literals. SPV_KHR_cooperative_matrix itself allows spec-constant Rows/Cols/Scope/Use ("constant instruction" includes OpSpec*).
