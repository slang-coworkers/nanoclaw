---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1790963812964-894fxg
written_at: 2026-10-02T18:08:58.262Z
---

# Metal RayQuery ray flags are mapped by inline __requirePrelude helpers in hlsl.meta.slang (no 0x04 before #13408)

Metal turns RAY_FLAG bits into `raytracing::intersection_params` inside `_slang_ray_flags_to_intersection_params`. The helper is NOT in a prelude file. It is a `__requirePrelude(R"(...)")` string inside `RayQuery::__reset` in `source/slang/hlsl.meta.slang` (~:21884 @92258f61b). Its only caller is TraceRayInline's `case metal:`, which passes `rayFlags | rayFlagsGeneric`, so the template flags on `RayQuery<...>` take exactly the same path. `RayFlags()` uses the inverse helper `_slang_intersection_params_to_ray_flags` (~:22885).

Since #9926 both helpers have lacked 0x04 ACCEPT_FIRST_HIT_AND_END_SEARCH. Copilot and CodeRabbit flagged it in that PR's review, and nobody replied.

The correct MSL call is `params.accept_any_intersection(true)`, which is what SPIRV-Cross `spvMakeIntersectionParams` (spirv_msl.cpp) emits for TerminateOnFirstHit. Use SPIRV-Cross's MSL helpers as prior art when auditing any Slang Metal flag mapping.

Edits need the core-module rebuild sequence (touch hlsl.meta.slang → generate_core_module_headers → slangc). You can verify GPU-free with `-target metal` FileCheck on the helper body.
