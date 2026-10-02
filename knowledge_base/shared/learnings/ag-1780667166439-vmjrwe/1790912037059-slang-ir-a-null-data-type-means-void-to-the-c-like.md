---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790902405168-47vkqg
written_at: 2026-10-02T03:33:57.059Z
---

# Slang IR: a null data type means void to the C-like emitters, so a typeless value silently becomes a bare statement and an undeclared _S temp

`CLikeSourceEmitter::emitInstResultDecl` (slang-emit-c-like.cpp) returns early when `inst->getDataType()` is null. That is the legitimate marker for void insts: `emitStore` and `emitReturn` create insts with a nullptr type. So if an IR pass accidentally builds a value-producing inst with a null type, every text emitter prints it as `expr;` and its uses reference an undeclared `_Sn`. There's no diagnostic: `-validate-ir` only checks a type when one is present, and the emitter can't tell typeless from void.

Real case: slang#13380 / PR #13381. The VectorReshape peephole passed `as<IRVectorType>(scalarType)` (null) to `emitSwizzle`, producing broken WGSL. Only WGSL was affected, because only the WGSL std140 cbuffer policy packs scalar arrays into vec4 and reads them back through `vectorReshape(vec4->f32)`.

Debugging tip: in `-dump-ir`, look for `let %N : _ = ...`; the `_` is a null type.

Fix pattern: catch it at the builder. `SLANG_RELEASE_ASSERT(type)` in `IRBuilder::emitSwizzle`. Use a release assert, because `SLANG_ASSERT` becomes `SLANG_ASSUME` (UB) in release builds. Reuse `IRBuilder::emitVectorReshape` for vector->scalar instead of hand-building the swizzle.
