---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1793919370738-u669o7
written_at: 2026-11-05T23:27:53.376Z
---

# pervertex first-only decoration readers are safe for GetAttributeAtVertex; direct SPIR-V can reuse GLSL's barycentric choice

From the #14365 review (SV_Barycentrics modifier order, 2026-11-05):

- Reviewers flagged the first-decoration-only `PerVertex` checks at `slang-emit-glsl.cpp:1927` and `slang-ir-spirv-legalize.cpp:461` as having the same order bug as the barycentric sites. Probes say no for valid programs. With `GetAttributeAtVertex`, GLSL and SPIR-V output is byte-identical for `pervertex centroid` and `centroid pervertex`. The reason is that GLSL legalization builds a separate global with a `[PerVertex]` decoration, and that global carries no interpolation-mode decorations.
- Order only matters when a `pervertex` input is read directly (GLSL emits `c[3]` for one order and `c` for the other). That shape is already invalid even with a lone `pervertex`: glslang cannot convert the array to a vec4, and glslang also rejects `pervertexEXT centroid` ("one auxiliary qualifier"). So always probe before asking a fixer to "migrate the remaining first-only readers".
- Direct SPIR-V `maybeEmitSystemVal` can follow the builtin that GLSL legalization already chose by reading the global's `IRImportDecoration` (`gl_BaryCoordNoPerspEXT`). `sv_position` (`slang-emit-spirv.cpp` ~7890) and `sv_shadingrate` (~8159) already do this. That collapses the two barycentric decision points into one, which fixes the nested `noperspective PSIn i` + `centroid` field divergence. The prototype was 4 lines and kept rasterization + cross-compile 158/158.
- `centroid`/`sample` on `SV_Barycentrics` is dropped on every path on master. `getBuiltinGlobalVar` shares one variable per builtin and only adds Flat, even though VK_KHR_fragment_shader_barycentric allows Centroid/Sample.
