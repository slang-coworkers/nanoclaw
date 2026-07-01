---
title: "Slang AS: forcing ray-query-only capability (avoid SPV_KHR_ray_tracing)"
type: learning
topic: slang-compiler
source: learnings/1781905197543-slang-as-forcing-ray-query-only-capability-avoid-s.md
---

# Slang AS: forcing ray-query-only capability (avoid SPV_KHR_ray_tracing)

When a Slang shader only uses inline ray tracing (`RayQuery` / `TraceRayInline`) but the emitted SPIR-V still pulls in `SPV_KHR_ray_tracing` (→ requires `VK_KHR_ray_tracing_pipeline` the user doesn't want):

**Why:** The `RaytracingAccelerationStructure` TYPE itself triggers `requireSPIRVAnyCapability({RayTracingKHR, RayQueryKHR})` + `ensureAnyExtensionDeclaration({SPV_KHR_ray_tracing, SPV_KHR_ray_query})` in `slang-emit-spirv.cpp`, regardless of how the AS value is produced. `OpConvertUToAccelerationStructureKHR` has the same "either" requirement. So merely having an AS value carries the dual requirement. PR #6615 (merged 2025-03, "Support spirv ops added by multiple extensions") added dedup so that when one alternative is already required (e.g. RayQueryKHR from RayQuery usage), the redundant one shouldn't be emitted. So a post-#6615 build with ray-query-only usage SHOULD collapse to ray_query.

**How to apply:**
- First: compile with `-capability spvRayQueryKHR` and confirm the build is post-March-2025 (has #6615).
- To GUARANTEE ray-query-only when converting a `uint64_t` device address to an AS, write the conversion in `spirv_asm` and explicitly declare the cap/ext inside the block: `OpExtension "SPV_KHR_ray_query"; OpCapability RayQueryKHR; result: $$RaytracingAccelerationStructure = OpConvertUToAccelerationStructureKHR $addr`. A bare `spirv_asm` block (no OpCapability) still compiles — Slang auto-declares the caps — but then the dual "any" requirement governs the outcome, so it won't necessarily drop ray_tracing.
- Verify with `-target spirv-asm` that only `SPV_KHR_ray_query` appears.
- Caveat: if the AS is also reachable from a `TraceRay`/raygen path, that path independently requires `RayTracingKHR` and will re-introduce the extension.
- If a post-#6615 build still emits ray_tracing for ray-query-only usage, it's a capability-resolution bug worth filing (ref #6615). Maintainer-endorsed AS-from-address pattern is issue #5801.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1781905197543-slang-as-forcing-ray-query-only-capability-avoid-s.md`_
