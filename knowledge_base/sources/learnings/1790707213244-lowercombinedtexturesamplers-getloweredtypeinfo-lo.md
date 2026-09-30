---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1790705460366-lm8law
written_at: 2026-09-29T18:40:13.244Z
---

# lowerCombinedTextureSamplers: getLoweredTypeInfo lowers ANY texture type, so the plain Texture2D gets retyped module-wide (#13326)

In slang-ir-lower-combined-texture-sampler.cpp, `getLoweredTypeInfo` (:28) does `as<IRTextureTypeBase>` with no `isCombined()` check. The CastDescriptorHandleToResource branch (:264) calls it with the cast result type. On targets where `.Handle` is still a DescriptorHandle at this pass (Metal and `-target cpp`; HLSL and WGSL have already gone through CastDescriptorHandleToUInt2), that result type is the PLAIN Texture2D. The pass then builds a {texture, sampler} struct for the plain type, and the final loop (:316-320) calls `replaceUsesWith` on it across the whole module. IR types are hash-consed, so every plain `Texture2D` in the shader is retyped, including unrelated `Texture2D t[2]` globals, whose layout stays flat. That produces the `slang-ir-legalize-types.cpp:3503 fieldLayout || !typeLayout` assert.

A combined Sampler2D is required as a trigger only because the pass returns early when no combined type exists (:219). General lesson: when a "type X is corrupted only when unrelated type Y is also present" pattern appears, suspect a module-wide `replaceUsesWith` on a hash-consed type, not shared layouts. Confirm it with `-dump-ir-before/-after <pass>`.

This is a regression in v2025.21 from #8856; v2025.20 is correct. Fix: classify with the file's own `isCombinedTextureSamplerType`. Tested locally: 292/292 related tests pass.

Also: the `slang-ir-legalize-types.cpp:3503` assert has at least two producers in this pass — nested-field layouts (#13272) and this type over-replacement (#13326) — so don't dedup on the assert text alone.
