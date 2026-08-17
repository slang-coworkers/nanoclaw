---
title: "GL_EXT_texture_shadow_lod bias-form boundary ≠ explicit-LOD boundary (Slang capability atoms)"
type: learning
topic: slang-compiler
source: learnings/1785190567550-gl-ext-texture-shadow-lod-bias-form-boundary-expli.md
---

# GL_EXT_texture_shadow_lod bias-form boundary ≠ explicit-LOD boundary (Slang capability atoms)

When answering about `texture_shadowlod`/`texture_shadowgrad`/`texture_shadowlod_ext` capability atoms in Slang's `hlsl.meta.slang`, do NOT reuse the `texture_shadowlod_ext` capdef doc-comment shape list (`sampler2DArrayShadow`/`samplerCubeShadow`/`samplerCubeArrayShadow`) as the boundary for BIAS forms — that list is for explicit-LOD ops. The BIAS boundary is narrower and documented at `source/slang/hlsl.meta.slang:1009-1016`:

- `texture(...)`/`textureOffset(...)` WITH bias are **core GLSL 1.50** for `sampler1DShadow`, `sampler1DArrayShadow`, `sampler2DShadow`, **and `samplerCubeShadow`**.
- `GL_EXT_texture_shadow_lod` only adds the **`sampler2DArrayShadow` and `samplerCubeArrayShadow`** bias variants (+ the `sampler2DArrayShadow` textureOffset+bias).
- `textureGrad`/`textureGradOffset` on shadow samplers are **entirely core GLSL** — the extension adds no gradient variants; grad wrappers never require it.

So `samplerCubeShadow` bias is core (differs from the LOD list), and gradients need no extension at all. The extension is requested branch-locally via `__requireCapability(GL_EXT_texture_shadow_lod)` inside the `__glsl_shadow_lod_*` bias wrappers, not baked into `texture_shadowgrad`'s floor.

Also, SM-tier facts (verified vs DXC `hctdb.py` + MS docs): `SampleCmp`/`SampleCmpLevelZero` = SM4.0/4.1; `SampleCmpLevel` = **SM6.7**; `SampleCmpBias`/`SampleCmpGrad` = **SM6.8**. Slang's `SampleCmpLevel` overloads are gated inconsistently by `texture_sm_4_1` (hlsl.meta.slang:1897,1956,3456) AND `texture_shadowlod` (2006,3396,3508) — both alias the SM4.1 floor, so it's an understated (SM6.7-should-be) but harmless pre-existing discrepancy. `texture_shadowlod = texture_sm_4_1`; `texture_shadowgrad = _sm_6_8 | _GLSL_150 | spirv_1_0` (HLSL floor SM6.8, GLSL/SPIR-V stay at 1.50/1.0).

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785190567550-gl-ext-texture-shadow-lod-bias-form-boundary-expli.md`_
