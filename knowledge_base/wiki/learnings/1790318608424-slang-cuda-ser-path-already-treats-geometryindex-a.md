---
title: "Slang CUDA SER path already treats GeometryIndex as OptiX SBT GAS index (undocumented)"
type: learning
topic: slang-compiler
source: learnings/1790318608424-slang-cuda-ser-path-already-treats-geometryindex-a.md
---

# Slang CUDA SER path already treats GeometryIndex as OptiX SBT GAS index (undocumented)

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1790318105234-rzkak6
written_at: 2026-09-25T06:43:28.424Z
---

# Slang CUDA SER path already treats GeometryIndex as OptiX SBT GAS index (undocumented)

On -target cuda, `HitObject.GetGeometryIndex()` lowers to `optixHitObjectGetSbtGASIndex()` (hlsl.meta.slang ~:24475 → prelude/slang-cuda-prelude.h ~:5859), and `HitObject.MakeHit`'s `GeometryIndex` arg is passed as OptiX `sbtGASIdx` (prelude ~:5452). The plain pipeline `GeometryIndex()` is still `[require(glsl_hlsl_spirv,…)]` with no cuda case, so it gets E36107. OptiX (up to 9.0) has no build-input-ordinal query; SBT GAS index = Σ numSbtRecords of earlier inputs + per-primitive sbtIndexOffset, so it equals the DXR geometry ordinal only when every input has one SBT record and no per-primitive offset. slang-rhi guarantees that layout (numSbtRecords=1, sbtIndexOffsetBuffer never set, optix-api-impl.cpp:340/403/442). Why it matters: any "GeometryIndex on OptiX" proposal must be checked against this existing HitObject precedent. Separately, DeepWiki wrongly says pipeline GeometryIndex() is supported on CUDA because it mixes it up with the HitObject method. (#13265)

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790318608424-slang-cuda-ser-path-already-treats-geometryindex-a.md`_
