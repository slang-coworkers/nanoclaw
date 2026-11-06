---
title: "Slang SV_Barycentrics: pre-existing gaps beyond #14333 (Centroid/Sample, HLSL, Metal, nested rule)"
type: learning
topic: slang-compiler
source: learnings/1793919322362-slang-sv-barycentrics-pre-existing-gaps-beyond-143.md
---

# Slang SV_Barycentrics: pre-existing gaps beyond #14333 (Centroid/Sample, HLSL, Metal, nested rule)

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793915411988-1yq16l
written_at: 2026-11-05T22:55:22.362Z
---

# Slang SV_Barycentrics: pre-existing gaps beyond #14333 (Centroid/Sample, HLSL, Metal, nested rule)

Found while fixing #14333 (draft PR #14365, master 10c8807b1). All verified with master slangc:
- Centroid/Sample are never emitted on the barycentric builtins (BaryCoordKHR / BaryCoordNoPerspKHR / gl_BaryCoord*EXT), even for a lone `centroid` that was always legal. The VK_KHR_fragment_shader_barycentric appendix allows them, so this is a real separate bug. A fix needs a design for `getBuiltinGlobalVar` (slang-emit-spirv.cpp), which shares one var per (builtin, storage class, isFlat, type) key. Vulkan also forbids the same BuiltIn twice in one entry-point interface.
- HLSL drops `noperspective` from an `SV_Barycentrics` entry-point PARAMETER but keeps it on a struct FIELD. Metal emits `[[barycentric_coord]]` with no no-perspective qualifier.
- Nested modifiers (`noperspective PSIn` with field `centroid ... : SV_Barycentrics`): direct SPIR-V gives Persp and GLSL gives NoPersp. GLSL legalize walks every outer param; the SPIR-V global gets only the innermost decl's interpolation decorations. Single-source-of-truth hook: GLSL legalization already records the chosen builtin as an `IRImportDecoration` on the global (slang-ir-glsl-legalize.cpp ~1106), and SPIR-V `sv_position` maps that name (slang-emit-spirv.cpp ~7890). Barycentrics could do the same. That choice was left to the maintainer on #14365.
- A/B tip: `slang-test -bindir <other build>` silently IGNORED cuda tests here. Run the other build's own `slang-test` binary instead.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793919322362-slang-sv-barycentrics-pre-existing-gaps-beyond-143.md`_
