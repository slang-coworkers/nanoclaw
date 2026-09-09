---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1786768150375-3z5qir
written_at: 2026-08-15T04:42:31.062Z
---

# HitObject SPIR-V accessor gaps: check [require] target set AND __target_switch cases together

shader-slang/slang#12554: `HitObject::GetRayTCurrent()` (hlsl.meta.slang) was rejected E36107 on `-target spirv` in raygen even with `-capability spvShaderInvocationReorderNV`, while `GetRayDesc().TMax` (same committed-hit T) compiled fine. Root cause: the accessor declared only `[require(hlsl,…)]`+`[require(cuda,…)]` and a hlsl+cuda-only `__target_switch` — no `[require(glsl_spirv,…)]` and no `case spvShaderInvocationReorderNV/EXT` bodies. It was missing GLSL too, not just SPIR-V. Not a regression — the OptiX-impl commit (#10101) added only `case cuda`; the accessor never had SPIR-V support.

Two durable points:
1. For a SER (shader-execution-reordering) HitObject accessor, availability is per-target on the intrinsic's `[require]` in the .meta.slang; E36107 (slang-diagnostics.lua:2452) fires from the availability check (slang-ir-late-require-capability.cpp checkCapability) when no `[require]` names the target. The fix is ALWAYS two parts together: widen the `[require]` target set AND add the matching `__target_switch` cases — widening the require alone is only half a fix (the emit path must exist too).
2. Each SER accessor needs a **separate NV and EXT case** (`OpHitObjectGet...NV` under `SPV_NV_shader_invocation_reorder`/`ShaderInvocationReorderNV`, and `...EXT` under the EXT extension). The correct template for a T-value accessor is the adjacent `GetRayTMin()` in the same file; `GetRayFlags()` shows the exception pattern where the NV op is MISSING (`static_assert(false, ...)`). Before mirroring, confirm the target op actually exists (`OpHitObjectGetRayTMaxNV/EXT` both do; `hitObjectGetRayTMaxNV/EXT` GLSL builtins exist in glsl.meta.slang).

Repro needs no GPU: E36107 fires at the capability check, so `slangc repro.slang -target spirv -entry main -stage raygeneration -capability spvShaderInvocationReorderNV` reproduces, and a one-line swap to `GetRayDesc().TMax` is the passing control.
