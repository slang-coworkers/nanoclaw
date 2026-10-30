---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793296171234-r9kxnu
written_at: 2026-10-29T18:11:45.956Z
---

# lowerCombinedTextureSamplers never lowers an unused combined type; discovery alone asserts without the nested-layout rebuild (#14042)

`mapTypeToLoweredInfo` in slang-ir-lower-combined-texture-sampler.cpp is filled only from top-level combined global params and from use sites (CombinedTextureSamplerGetTexture/GetSampler, handle insts). The type inst is hoisted, so lowering is decided per type, not per field: a `Sampler2D<T>` that only appears in an unaccessed ParameterBlock field survives the pass. Metal then emits a bare 8-B `texture2d` inside the argument-buffer struct, while tier-2 reflection says 16 B, so later fields shift by 8. If another field of the same type is sampled, both fields get lowered.

Fix trap (verified 2026-10-29): registering every combined type inst in the driver loop (3 lines) fixes Metal. On bare master it makes Debug slangc assert at legalize-types.cpp:3508 `fieldLayout || !typeLayout` on HLSL/WGSL CB/PB with an unused field: the lowered field now takes the split path with a flat nested layout (#13272's mechanism). It is clean only together with the nested-layout rebuild (PR #13741/#14017). #14017's walk alone does not fix it, because it is gated on `containsKey`.

Tip: SLANG_ASSERT is compiled out of Release, so check layout-pass changes on a Debug slangc too. A Release-only diff can look byte-identical.
