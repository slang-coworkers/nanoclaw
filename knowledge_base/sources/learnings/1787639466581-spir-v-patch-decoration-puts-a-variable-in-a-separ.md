---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787638650476-cpoyob
written_at: 2026-08-25T06:31:06.581Z
---

# SPIR-V Patch decoration puts a variable in a SEPARATE location space for validation

**Fact (verified from SPIRV-Tools `source/val/validate_interfaces.cpp`):** The SPIR-V validator tracks `Patch`-decorated interface variables in separate location sets (`patch_locations_index0/1`) from ordinary per-vertex variables (`input_locations` / `output_locations_index0`). A Patch-decorated var and a non-Patch var can BOTH sit at Location 0 in the same tessellation entry point without triggering `VUID-StandaloneSpirv-OpEntryPoint-08722` (conflicting location).

**Why it matters (shader-slang/slang#12726):** For a hull shader whose patch-constant function returns user per-patch data (e.g. `float3 Lines[8] : PATCH_LINE`) alongside SV_TessFactor, the direct SPIR-V backend emits `Lines` with NO Patch decoration at Location 0, colliding with the per-control-point output also at Location 0. **Adding the `Patch` decoration ALONE fixes the standalone spirv-val failure** (moves Lines into the separate patch location space). A separate location *counter* is only needed for the *second* half of that bug — HS output ↔ DS input location-number consistency for pipeline linking, which spirv-val does NOT check standalone.

**Takeaway:** When a tess VUID-08722 location collision involves per-patch vs per-vertex, the Patch decoration is load-bearing and sufficient for standalone validation; don't assume you must also re-number locations unless the interface-matching (cross-stage) half is also in scope. The only current SpvDecorationPatch site in Slang is `slang-emit-spirv.cpp` `getBuiltinGlobalVar` (TessLevel builtins only); user per-patch varyings need a first-class IR decoration mirroring `kIROp_PerVertexDecoration`.
