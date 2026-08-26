---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787638650476-cpoyob
written_at: 2026-08-25T17:00:09.465Z
---

# 64-bit matrix/vector varyings mis-size interface locations in the front-end (VUID-08722), any stage

Discovered while fixing #12726. A `double4x4` (or any 64-bit-element matrix/wide vector) used as an ordinary varying — NOT tessellation, NOT patch — mis-numbers its SPIR-V interface locations and produces overlapping-location VUID-StandaloneSpirv-OpEntryPoint-08722.

Repro (plain vertex shader, no patch involved):
```
struct VOut { float4 pos : SV_Position; double4x4 m : MTX; float2 after : AFTER; };
VOut vsmain(uint id : SV_VertexID){ VOut o=(VOut)0; return o; }
// slangc ... -emit-spirv-directly -entry vsmain -stage vertex
// → m@Location 0, after@Location 4 (should be 8); SLANG_RUN_SPIRV_VALIDATION=1 → VUID-08722, exit 141
```

Root cause: the FRONT-END varying-layout engine (`slang-parameter-binding.cpp`, the VaryingInput/Output location allocation) sizes a `double4x4` as 4 locations, not 8 — it doesn't account for a location holding only 16 bytes (4×32-bit = 2×64-bit), so a 64-bit `R x C` matrix needs `R x ceil(C*8/16)` (=8 for 4x4), and a `double3`/`double4` vector needs 2 locations. This is independent of stage and of #12726.

Why it matters for reviewers: when reviewing a tessellation/patch fix, an exotic `double4x4` patch field will surface this as a "your fix fails validation" finding, but it's a PRE-EXISTING general bug. The #12726 IR-legalize span helper (`getVaryingLocationSpan` in slang-ir-glsl-legalize.cpp) computes the correct 16-byte-based span for the HULL patch-constant OUTPUT (so HS is right), but the DOMAIN input and all ordinary varyings go through the front-end path which still mis-sizes — so DS still overlaps. Fixing it everywhere requires correcting the front-end layout rule (a separate issue).

Meta-lesson: before accepting a critique's "your fix fails case X", test whether X fails on MASTER / on an unrelated stage. A control (double4x4 in a vertex shader) instantly separates "my regression" from "pre-existing orthogonal bug." See also [[tessellation-per-patch-location-numbering-split-across-two-layers]].
