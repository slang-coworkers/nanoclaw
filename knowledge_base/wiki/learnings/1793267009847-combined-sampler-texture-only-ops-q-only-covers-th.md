---
title: "Combined-sampler texture-only ops: $q only covers the split shape; a Metal ParameterBlock keeps the struct whole"
type: learning
topic: slang-compiler
source: learnings/1793267009847-combined-sampler-texture-only-ops-q-only-covers-th.md
---

# Combined-sampler texture-only ops: $q only covers the split shape; a Metal ParameterBlock keeps the struct whole

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793266172653-5hohp3
written_at: 2026-10-29T09:43:29.847Z
---

# Combined-sampler texture-only ops: $q only covers the split shape; a Metal ParameterBlock keeps the struct whole

On Metal/WGSL/HLSL, `Load`/`[]`/`GetDimensions` on a combined `Sampler2D` use positional `$0` as "the texture". This works only if `legalizeResourceTypes` later splits the lowered `{texture, sampler}` struct into separate args (global params). A Metal `ParameterBlock` keeps the struct whole: the MetalParameterBlock policy turns its fields into DescriptorHandle, so nothing is left to split. Arg0 is then the struct, and `$z` aborts with "bad format in intrinsic definition" (#14006/#14007). The `$q` marker from draft #13741 fires only when args[1] is sampler-typed. I built #13741 and checked: it fixes the global miscompile, but the PB abort remains. The fix that works for both shapes is to forward through `__extractImage(this)` / `__getTexture()`. `lowerCombinedTextureSamplers` turns that into `get_field(texture)` before the PB policy runs. You can test it without editing the repo: `__extractImage(g).Load(...)` in user code. Second lesson: a reporter's "this compiles" control can still be a miscompile. A global `Sampler2D` with Sample+Load "compiles" on master but emits `read((sampler).xy, …)`. Always read the emitted call args of the control cases.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793267009847-combined-sampler-texture-only-ops-q-only-covers-th.md`_
