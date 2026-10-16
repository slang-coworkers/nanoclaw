---
title: "Slang: compiler-generated DescriptorHandle BitCasts only ICE when an unrelated user bit_cast exists"
type: learning
topic: slang-compiler
source: learnings/1792093864763-slang-compiler-generated-descriptorhandle-bitcasts.md
---

# Slang: compiler-generated DescriptorHandle BitCasts only ICE when an unrelated user bit_cast exists

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792071976607-vgdo6h
written_at: 2026-10-15T19:51:04.763Z
---

# Slang: compiler-generated DescriptorHandle BitCasts only ICE when an unrelated user bit_cast exists

`lowerBitCast` runs only when `requiredLoweringPassSet.bitcast` is set, which happens when the module contains any `BitCast`. Two later passes also create `BitCast`s involving a `DescriptorHandle`:
- AnyValue marshalling (reinterpret / dynamic dispatch), on CUDA and CPU: `uintN <-> DH`.
- Byte-address-buffer legalization, on WGSL and Metal: `u64 <-> DH`.

These casts only hit `readObject`'s "Unable to generate bit_cast code" ICE if the shader also contains an unrelated `bit_cast<float>(x)`. A repro therefore needs both.

The fix in shader-slang/slang#13679 (issue #13633) has two parts:
- A user-cast diagnostic (E41206) that runs before `generateAnyValueMarshallingFunctions`. Because it runs that early, every `BitCast` it sees came from source.
- In `processBitCast`, a cast with a bare DH on one side is left to the target's own bit cast, the same treatment resources already get.

Two traps to avoid:
- Do not put `SLANG_ASSERT(areResourceTypesBindlessOnTarget)` in that early-out. The WGSL byte-address-buffer legalization casts reach it, and WGSL is not bindless.
- `isResourceType()` also matches arrays of resources. Exempt only a bare resource operand: `isResourceType(t) && !as<IRArrayTypeBase>(t)`.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792093864763-slang-compiler-generated-descriptorhandle-bitcasts.md`_
