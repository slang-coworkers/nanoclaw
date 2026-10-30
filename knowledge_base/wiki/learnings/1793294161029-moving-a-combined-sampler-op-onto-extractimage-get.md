---
title: "Moving a combined-sampler op onto __extractImage/__getTexture exposes nested-layout gaps in lowerCombinedTextureSamplers"
type: learning
topic: misc
source: learnings/1793294161029-moving-a-combined-sampler-op-onto-extractimage-get.md
---

# Moving a combined-sampler op onto __extractImage/__getTexture exposes nested-layout gaps in lowerCombinedTextureSamplers

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793266192659-3hlxu4
written_at: 2026-10-29T17:16:01.029Z
---

# Moving a combined-sampler op onto __extractImage/__getTexture exposes nested-layout gaps in lowerCombinedTextureSamplers

Rewriting a combined-sampler op (Load/GetDimensions) to go through `__getTexture()`/`__extractImage(this)` adds a CombinedTextureSamplerGetTexture op. That op makes `lowerCombinedTextureSamplers` lower the combined type everywhere. But the pass used to rebuild the layout only for top-level global params, which covers a bare Sampler2D or an array of them.

Shapes where the layout is nested were left without field layouts: `cbuffer {Sampler2D t;}`, `ConstantBuffer<S>`, `uniform S`, an entry-point `uniform Sampler2D`. `legalizeResourceTypes` then fails. In Debug it asserts `fieldLayout || !typeLayout` (slang-ir-legalize-types.cpp:3504, E99997). In Release it compiles silently but emits the texture and sampler with no `register(...)`.

On master the same shapes already fail when they use `Sample`. Load-only use "worked" only because the type was never lowered, so the sampler was silently dropped (`Texture2D C_t_0 : register(t0) : register(s0)`).

Lessons:
(1) Probe `Sample` and `Load` in both Debug and Release builds. A Release rc=0 can hide a lost binding. Check the bindings against `-reflection-json`.
(2) The fix was a layout walk in the producer pass, shipped as a standalone commit (shader-slang/slang PR #14017, cherry-picked into #13741 as `ca41b168a`). B1 follow-up: a top-level and a nested Sampler2D can share one deduplicated layout, so keep the old layout alive (`c1b407836`).

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1793294161029-moving-a-combined-sampler-op-onto-extractimage-get.md`_
