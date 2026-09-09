---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787171893366-da0phm
written_at: 2026-08-19T20:57:33.502Z
---

# HLSL RAY_FLAG vs OptiX OptixRayFlags — only 0x100/0x200 lack an equivalent (0x400 DOES map)

Context: slang#12629 — `slangc -target cuda` passes HLSL ray flags with no OptiX counterpart verbatim into `optixTrace` (silent miscompile). To emit a correct compile-time diagnostic you must key the "unsupported" mask off the ACTUAL `OptixRayFlags` enum, NOT a "any bit >= 0x100" heuristic.

Authoritative source: OptiX SDK `external/optix-dev/include/optix_types.h`, `typedef enum OptixRayFlags`. The submodule is not checked out by default; `git submodule update --init --depth 1 external/optix-dev` in the base clone populates it.

OptixRayFlags bits: DISABLE_ANYHIT=1<<0, ENFORCE_ANYHIT=1<<1, TERMINATE_ON_FIRST_HIT=1<<2, DISABLE_CLOSESTHIT=1<<3, CULL_BACK_FACING_TRIANGLES=1<<4, CULL_FRONT_FACING_TRIANGLES=1<<5, CULL_DISABLED_ANYHIT=1<<6, CULL_ENFORCED_ANYHIT=1<<7, **FORCE_OPACITY_MICROMAP_2_STATE=1<<10 (=0x400)**. There is NO bit 8 or bit 9.

Mapping to HLSL RAY_FLAG (hlsl.meta.slang:19442-19495), all identical bit values:
- 0x01..0x80 (bits 0-7): FORCE_OPAQUE↔DISABLE_ANYHIT, FORCE_NON_OPAQUE↔ENFORCE_ANYHIT, ACCEPT_FIRST_HIT_AND_END_SEARCH↔TERMINATE_ON_FIRST_HIT, SKIP_CLOSEST_HIT_SHADER↔DISABLE_CLOSESTHIT, CULL_BACK/FRONT_FACING_TRIANGLES↔same, **CULL_OPAQUE(0x40)↔CULL_DISABLED_ANYHIT, CULL_NON_OPAQUE(0x80)↔CULL_ENFORCED_ANYHIT** — value AND semantics match (DXR "opaque" == "any-hit-disabled geometry"; same mutual-exclusivity documented in the OptiX header). NOT a silent-wrong hazard.
- **RAY_FLAG_FORCE_OMM_2_STATE (0x400) ↔ FORCE_OPACITY_MICROMAP_2_STATE (1<<10=0x400)** — coincident bit value ⇒ it DOES translate correctly. A ">=0x100" mask would wrongly flag it.
- **The ONLY unsupported HLSL bits are RAY_FLAG_SKIP_TRIANGLES=0x100 (bit 8) and RAY_FLAG_SKIP_PROCEDURAL_PRIMITIVES=0x200 (bit 9)** — OptiX controls triangle/AABB skipping at the pipeline/traversable level, not per-ray. SPIR-V has SkipTrianglesKHR=0x100/SkipAABBsKHR=0x200 so Vulkan honors them; OptiX genuinely cannot express them per-ray ⇒ a diagnostic (not a translation) is correct.

Correct mask: supported = bits{0-7,10} = 0x4FF; unsupported = `flags & ~0x4FF` (i.e. 0x100 | 0x200 for current DXR). Key it off the named OptiX set, not a threshold, so a future OptiX bit-8/9 addition doesn't need a magic-number edit.
