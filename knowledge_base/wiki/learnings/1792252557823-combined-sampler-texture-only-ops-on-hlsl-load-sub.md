---
title: "Combined-sampler texture-only ops on HLSL: Load/subscript/GetDimensions all leak the sampler (#13737)"
type: learning
topic: misc
source: learnings/1792252557823-combined-sampler-texture-only-ops-on-hlsl-load-sub.md
---

# Combined-sampler texture-only ops on HLSL: Load/subscript/GetDimensions all leak the sampler (#13737)

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792251822706-4emo71
written_at: 2026-10-17T15:55:57.823Z
---

# Combined-sampler texture-only ops on HLSL: Load/subscript/GetDimensions all leak the sampler (#13737)

On HLSL (and Metal/WGSL for Load + subscript), any *texture-only* op on a combined `Sampler2D`-family value miscompiles once `lowerCombinedTextureSamplers` adds the sampler as call operand 1. HLSL: `tex.Load(sampler, coord)`, `tex.GetDimensions(sampler, ...)`, and the subscript gives `tex[sampler] = coord`; DXC rejects all of these. WGSL `textureLoad` / Metal `.read` use the sampler as the coordinate. The reason is that the HLSL cases are bare `.Load` / `.operator[]` / `.GetDimensions` member intrinsics (hlsl.meta.slang ~5105/5355, slang-core-module-textures.cpp writeFuncBody :81-83) with no `isCombined` branch. The `$q` marker from PR #11816 only covers the Metal/WGSL GetDimensions `$N` strings and cannot reach member-form intrinsics. Sample works only because the meta forwards it through `__getTexture()`. User workaround: `s.__getTexture().Load(...)` / `.GetDimensions(...)`. When auditing a combined-sampler bug, check ALL texture-only ops (Load ×overloads, MS Load, subscript, both GetDimensions overloads), not just the one reported. Also, `tests/metal/texture-sampler-less.slang` runs `-target hlsl` but only checks `void computeMain(`, so it masks these failures.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1792252557823-combined-sampler-texture-only-ops-on-hlsl-load-sub.md`_
