---
type: triage
---
# Triage: shader-slang/slang#14333 — SPIR-V: modifier order changes SV_Barycentrics interpolation
Date: 2026-11-05 | bug | medium | P2 | target-emit (SPIR-V + GLSL) / IR legalize | Duplicate: no

## What's broken
`centroid noperspective` (or `sample noperspective`) on an `SV_Barycentrics` input picks the
perspective builtin on direct SPIR-V. The reporter says GLSL is correct. That is true only for
their order: GLSL is wrong for the REVERSE order. Each path reads only the FIRST
`IRInterpolationModeDecoration`, and the two paths read lists with opposite orders.

## Repro (ToT b3d4e7ad4, debug slangc; files in /workspace/agent/repro-14333/)
| modifiers | direct SPIR-V | GLSL | SPIR-V via GLSL |
|---|---|---|---|
| noperspective | NoPersp ✅ | NoPersp ✅ | NoPersp ✅ |
| centroid noperspective | BaryCoordKHR ❌ | NoPersp ✅ | NoPersp ✅ |
| noperspective centroid | NoPersp ✅ | gl_BaryCoordEXT ❌ | BaryCoordKHR ❌ |
| sample noperspective | BaryCoordKHR ❌ | NoPersp ✅ | NoPersp ✅ |
| noperspective sample | NoPersp ✅ | gl_BaryCoordEXT ❌ | BaryCoordKHR ❌ |
| struct field, both orders | same pattern as the param rows | | |
| `noperspective PSIn` + inner `centroid` field | BaryCoordKHR | NoPersp | NoPersp |
Non-builtin varyings (TEXCOORD0) are correct in every order: SPIR-V emits both decorations, and GLSL
emits both qualifiers. `pervertex centroid`: both orders give PerVertexKHR + array (not affected).
`slangc bary-cn.slang -target spirv-asm | grep BaryCoord`

## Not a regression
Before #13923 (390874bbc, 2026-10-28, first in v2026.21), any mode + centroid/sample was
`E31202 duplicate modifier` (checked: v2026.13.1 release binary rejects bary-cn). #13923 split the
conflict groups and made the varying copy keep all decorations, but it did not update the two
barycentric selection sites. So the combination never worked. This is a gap left by #13923.
#12194 (#10584) changed only core.meta/check-shader/entry-point/lower-to-ir capability code. It
does not touch interpolation or builtin selection, so it is not related.

## Codebase digest
- `slang-emit-spirv.cpp:8114-8117` `maybeEmitSystemVal` sv_barycentrics: `findDecoration<IRInterpolationModeDecoration>()` → first only.
- `slang-ir-glsl-legalize.cpp:951-962` `getGLSLSystemValue`: walks outerParamInfo chain; each node `findDecoration` (957) → first only; NoPersp on ANY node wins.
- `slang-ir-glsl-legalize.cpp:1083-1095` `createVarLayoutForLegalizedGlobalParam`: copies all interp decorations of the INNERMOST decl that has any onto the global (via addDecoration → insertAtStart, reversing order again).
- `slang-ir.cpp:7410-7419` addDecoration inserts at head ("decoration order should not be semantically meaningful").
- `slang-lower-to-ir.cpp:~3160-3188` one decoration per modifier → original param list = reverse source order; copied global = source order. Explains the mirror-image failure.
- Latent first-only readers (PerVertex, not observed failing): `slang-emit-glsl.cpp:1927`, `slang-ir-spirv-legalize.cpp:461`. `slang-emit-spirv.cpp:3713` is an existence check only, so it is fine.
- Tests: `tests/pipeline/rasterization/get-attribute-at-vertex{,-struct}.slang` (plain noperspective only); `tests/diagnostics/interpolation-mode-and-sampling.slang` (combos on TEXCOORD only).

## Candidate approaches
### A: order-independent mode query at both barycentric sites (shared helper)
- Where: add e.g. `bool hasInterpolationMode(IRInst*, IRInterpolationMode)` (or `IRInst` helper in slang-ir-util.h); use at emit-spirv:8114 and glsl-legalize:957.
- Delta: both orders → NoPersp on SPIR-V, GLSL, via-GLSL. Struct-field case also fixed.
- Tradeoffs: tiny, local; one rule for "is NoPerspective present". Leaves the nested outer/inner divergence (GLSL any-node vs SPIR-V innermost-copied).
- Risk: low; only affects inputs that #13923 newly allowed.
### B: A + unify the nested-chain rule (single source of truth)
- Where: glsl-legalize:951 picks the barycentric variant by the same "innermost decl with any interp decoration" rule used by the copy at :1083 (or SPIR-V consumes the same answer).
- Delta: also makes `noperspective PSIn{ centroid float3 b : SV_Barycentrics; }` agree across targets (today GLSL=NoPersp, SPIR-V=Persp). Generic varyings already use innermost-wins (that TEXCOORD case emits only Centroid).
- Tradeoffs: changes GLSL output for that rare nested case; needs a judgment on which rule is right.
- Risk: low-medium (behaviour change on an existing GLSL path, though only for mixed nested modifiers).
### C (rejected): preserve source order in addDecoration / insert at end
- `slang-ir.cpp:7410` comment: order is not meant to be semantically meaningful. A first-only reader is still wrong whenever two modes are present. It would also touch every decoration user.

## Recommended path
A (fastest correct fix, no regressions to adjacent surfaces). Fold in B only if the fixer agrees
innermost-wins is the intended rule. Optionally harden the two PerVertex first-only readers with
the same helper. That part is latent, with no failing repro, so it is a judgment call.
Repro: `slangc bary-cn.slang -target spirv-asm` (and `-target glsl` on bary-nc.slang).
Acceptance: `centroid|sample` × `noperspective` in both orders, as an entry param AND as a struct
field, give `BuiltIn BaryCoordNoPerspKHR` (direct + `-emit-spirv-via-glsl`) and `gl_BaryCoordNoPerspEXT`
(GLSL), with the Centroid/Sample decoration/qualifier still emitted where applicable. Add a filecheck
test next to `tests/pipeline/rasterization/get-attribute-at-vertex.slang` (or extend
`tests/diagnostics/interpolation-mode-and-sampling.slang`). Run with SLANG_RUN_SPIRV_VALIDATION=1.

## Sources
- DeepWiki: SPIR-V maybeEmitSystemVal uses findDecoration (first only); GLSL legalize walks the chain; there is no existing "has mode" helper. Metal/WGSL iterate all decorations.
- PR #8067 (#7816) added the noperspective barycentric selection; PR #13923 allowed mode + sampling combos; PR #12194 unrelated.
- Shared learning: "verifying one case and assuming its neighbour matches" (GLSL chain loop is any-node, not innermost).
