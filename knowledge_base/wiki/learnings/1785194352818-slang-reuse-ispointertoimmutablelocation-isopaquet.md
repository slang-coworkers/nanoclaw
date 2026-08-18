---
title: "slang: reuse isPointerToImmutableLocation / isOpaqueType for constref copy-elision (do not hand-roll)"
type: learning
topic: slang-compiler
source: learnings/1785194352818-slang-reuse-ispointertoimmutablelocation-isopaquet.md
---

# slang: reuse isPointerToImmutableLocation / isOpaqueType for constref copy-elision (do not hand-roll)

When designing a fix that must recognize "address-only / non-copyable / immutable-location" types across the whole class (ParameterBlock, ConstantBuffer, read-only StructuredBuffer/ByteAddressBuffer, read-only textures, samplers, and structs transitively containing them), **reuse the existing canonical predicates** rather than writing a new switch:
- `isPointerToImmutableLocation(IRInst* loc)` — `slang-ir-util.cpp:3105`. Returns true for HLSLStructuredBuffer/ByteAddressBuffer/ConstantBuffer/ParameterBlock + read-only textures; walks element-access chains (GetStructuredBufferPtr/RWStructuredBufferGetElementPtr/ImageSubscript); and correctly EXCLUDES RW-alias and the OptiX-SBT case (#10188, which is typed ConstantBuffer but host-mutated).
- `isOpaqueType(IRType*, IRType** outLeaf)` — `slang-legalize-types.cpp:257`. Recursive, cycle-safe, covers structs transitively containing resources. `isResourceType` (:164) is the non-recursive immediate check.
- `isPtrLikeOrHandleType` (slang-ir-util.cpp:1229), `isIROpaqueType` (:3063) are narrower cousins.

Context (slang#8002): `slang-ir-transform-params-to-constref.cpp:186` `isLoadFromImmutableAddress` hand-rolls a narrow switch (ConstantBuffer/BorrowInParam/ParameterBlock only) — it predates/duplicates `isPointerToImmutableLocation`. When extending constref copy-elision, swap the narrow switch for the util predicate to get full coverage in one source of truth.

Also verified: `lowerGlobalShaderParam` wraps a global param as `LoweredValInfo::simple(irParam)` (slang-lower-to-ir.cpp:11586) even though the comment at :11619 says "a global variable's SSA value is a *pointer*"; `tryGetAddress` has no `Flavor::Simple` case, so a global resource/PB param never presents as a Ptr and forces the by-ref temp path. `assign(tempVar, simpleGlobalParam)` emits a bare `store(v, %g)` (no load, :10277), which is why `undoParameterCopy` (matches `store(v, load(orig))`) misses it. Precedent for ptr-wrapping a param exists at :14085.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1785194352818-slang-reuse-ispointertoimmutablelocation-isopaquet.md`_
