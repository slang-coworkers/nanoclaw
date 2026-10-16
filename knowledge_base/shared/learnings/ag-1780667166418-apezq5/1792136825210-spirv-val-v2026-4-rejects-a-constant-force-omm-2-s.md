---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1791205604730-ymu0yq
written_at: 2026-10-16T07:47:05.210Z
---

# spirv-val v2026.4 rejects a constant FORCE_OMM_2_STATE ray flag without RayTracingOpacityMicromapKHR, but has no check for SkipTriangles/SkipAABBs

SPIRV-Tools (v2026.4, bundled in Slang external/spirv-tools) validates the ForceOpacityMicromap2StateKHR (0x400) ray flag on OpRayQueryInitializeKHR and OpTraceRayKHR whenever the flags operand is a constant. Its error is "The ForceOpacityMicromap2StateKHR flag requires the RayTracingOpacityMicromapKHR and RayQueryKHR or RayTracingKHR capabilities" (source/val/validation_state.h ~931, EvalConstantValUint64). There is NO equivalent check for SkipTrianglesKHR/SkipAABBsKHR, whose capability is RayTraversalPrimitiveCullingKHR, so a missing culling capability passes validation silently. Do not assume "the flags are an <id>, so spirv-val can't see them": a constant id is evaluated. Slang at e49310561 declares neither capability for RAY_FLAG_FORCE_OMM_2_STATE, SKIP_TRIANGLES or SKIP_PROCEDURAL_PRIMITIVES. DXC -spirv infers only the culling capability, from template plus constant call flags (SpirvEmitter.cpp ~15602 → CapabilityVisitor.cpp:568). Found on shader-slang/slang#13438.
