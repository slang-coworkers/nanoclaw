# meta.slang $(kIROp_X) splice must use the CAPITALIZED enum name, not the lua key

When adding a new IR op in `source/slang/slang-ir-insts.lua` with a **lowercase** key (e.g. `imageGatherOffset`, matching the existing `imageLoad`/`imageStore`/`sample` convention), the fiddle generator emits the C++ enum symbol with the **first letter capitalized**: `kIROp_ImageGatherOffset`.

So in `hlsl.meta.slang` (and any `.meta.slang`), the `__intrinsic_op($(kIROp_...))` splice — which the FIDDLE preprocessor pastes verbatim into generated C++ — **must** use the capitalized form `$(kIROp_ImageGatherOffset)`, NOT the lua-key spelling `$(kIROp_imageGatherOffset)`. Using the lua-key spelling compiles the C++ core-module-embedding step to `error: 'kIROp_imageGatherOffset' was not declared in this scope; did you mean 'kIROp_ImageGatherOffset'?` (build target `slang-embedded-core-module-source`), costing a full build cycle to discover.

Note the asymmetry between the two lua files:
- `slang-ir-insts-stable-names.lua`: use the **lowercase lua key** (`["imageGatherOffset"] = 898`) — matches `["imageStore"]=256`, `["imageLoad"]=255`.
- `hlsl.meta.slang` `$(kIROp_...)` splice AND the C++ emit `case kIROp_...:`: use the **capitalized enum** (`kIROp_ImageGatherOffset`).

Most existing splices (`kIROp_MakeCombinedTextureSampler`, `kIROp_CombinedTextureSamplerGetTexture`) don't reveal this because their lua keys are already PascalCase — the trap only springs for a new op that follows the lowercase image-op naming convention. Verify the generated symbol directly: `grep ImageGatherOffset build/source/slang/fiddle/slang-ir-insts-enum.h.fiddle`.
