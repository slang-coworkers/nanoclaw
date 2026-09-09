---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787704935844-cumrh2
written_at: 2026-08-26T01:02:25.739Z
---

# globallycoherent on resource params: two front-end gates + an emit gap

Fixing slang#12763 (`globallycoherent RWByteAddressBuffer` as a function parameter). Three front-end/emit facts that were non-obvious:

1. **Two gates reject a `globallycoherent` resource param, and they are in different files.**
   - `isModifierAllowedOnDecl` (`slang-check-modifier.cpp`, ~line 1731): the `case GloballyCoherentModifier:`/`HLSLVolatileModifier:` arm's GLSL branch includes `|| as<ParamDecl>(decl)` but the **non-GLSL (default HLSL/Slang) branch omits it**. So `globallycoherent` on a param compiles only under `-allow-glsl`. Sibling read/write/volatile/restrict arms allow ParamDecl in both modes — the omission is an inconsistency, not an invariant.
   - `visitParamDecl` (`slang-check-decl.cpp`, ~line 13991): a second guard `paramDecl->type->astNodeType != ASTNodeType::TextureType` diagnoses any surviving `MemoryQualifierSetModifier` on a non-texture param. Once gate 1 is relaxed, THIS rejects `RWByteAddressBuffer`. Both must be widened. The call-site check `compareMemoryQualifierOfParamToArgument` (`slang-check-expr.cpp` ~3904) needs NO change — E30048 is purely a cascade of gate 1 dropping the param's bit.

2. **Coherent-capable resource types span 3 disjoint AST bases** — no single common base. Textures/images = `TextureTypeBase` (→ ResourceType); structured buffers = `HLSLStructuredBufferTypeBase` (→ BuiltinGenericType); byte-address/other untyped buffers = `UntypedBufferResourceType` (→ BuiltinType). `RWTexture2D`/`Texture2D`/GLSL `image2D` ALL map to `__magic_type(TextureType)`. To widen gate 2 by role, test `as<TextureTypeBase>() || as<HLSLStructuredBufferTypeBase>() || as<UntypedBufferResourceType>()`.

3. **THE CRUX (emit): `emitSimpleFuncParamImpl` does NOT emit memory-qualifier decorations.** Lowering (`addVarDecorations`, slang-lower-to-ir.cpp ~3116) DOES attach `IRMemoryQualifierSetDecoration` to IR params (called at ~14029). But `CLikeSourceEmitter::emitSimpleFuncParamImpl` (slang-emit-c-like.cpp ~3863) and the HLSL override never call `emitVarDecorationsImpl`/`emitVarModifiers` — so a **non-inlined HLSL** helper emits `void f(RWByteAddressBuffer b)` dropping `globallycoherent`. On SPIR-V/GLSL/WGSL this is moot: `specializeResourceParameters` routes the param to the concrete global (which carries the decoration); and SPIR-V under the Vulkan memory model resolves coherence per-access via `NeedToUseCoherentLoadOrStore` which walks `getRootAddr` back to the base buffer. `performForceInlining` only inlines `IRForceInlineDecoration`-marked funcs, so a plain HLSL helper is NOT auto-inlined ⇒ the emit gap is real for HLSL and needs `emitSimpleFuncParamImpl` to emit the qualifier as a prefix (`globallycoherent `, space not newline). VERIFY empirically per target before deciding scope.

Maintainer constraint: csyonghe (#11460) said do NOT broaden the `IRAttributedType` mechanism. The decl→`IRMemoryQualifierSetDecoration` path used here is separate, so it's compatible — but confirm with the maintainer since it's the same feature area.
