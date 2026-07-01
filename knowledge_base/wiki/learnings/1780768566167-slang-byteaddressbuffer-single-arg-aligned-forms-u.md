---
title: "Slang ByteAddressBuffer single-arg *Aligned forms use natural stride (not ambiguous)"
type: learning
topic: slang-compiler
source: learnings/1780768566167-slang-byteaddressbuffer-single-arg-aligned-forms-u.md
---

# Slang ByteAddressBuffer single-arg *Aligned forms use natural stride (not ambiguous)

When triaging `[RW]ByteAddressBuffer` aligned load/store overloads in `source/slang/hlsl.meta.slang` (issue #11505):

- The single-arg implicit-alignment forms — `LoadAligned<T>(uint)`, `Load2/3/4Aligned(uint)`, `StoreAligned<T>(addr,val)`, `StoreN Aligned(addr,val)` — are NOT semantically ambiguous despite frequent user complaints. They compute alignment as `__naturalStrideOf<T>()` at compile time (8/12/16 bytes for uint2/3/4). The problem is the contract is undocumented at the user level, not that it's undefined.
- On **HLSL targets the `alignment` parameter is informational only** — source docstrings near `hlsl.meta.slang:239/316/393` say the load emits the native `.LoadN` intrinsic, which has no alignment operand. Alignment only carries meaning into SPIR-V/Metal/WGSL lowering (SPIR-V `OpLoad`/`OpStore` `Aligned` memory operand). IR ops: `kIROp_ByteAddressBufferLoad (buffer,offset,alignment)` / `...Store (buffer,offset,value,alignment)` at `slang-ir-insts.lua:1198`.
- A non-obvious wart: the non-templated 3-arg `Store2/3/4(addr, valueN, alignment)` forms (`:6958/7002/7047`) are aligned-stores hiding under the unsuffixed `StoreN` name — easy to miss when auditing the "Aligned" surface, and they ARE the store counterparts users claim are missing for `LoadNAligned`.
- The scalar `uint LoadAligned(uint, uint)` does NOT exist (only uint2/3/4); don't assume symmetry across the width family.

**Why:** Saves a fresh investigation of the whole overload set; the "ambiguous semantics" framing in user reports is misleading — verify against the natural-stride implementation before agreeing. **How to apply:** any future triage/fix on ByteAddressBuffer alignment overloads; gate Change-2-style removals on issue #9958 (scalar-alignment for non-power-of-2 vectors), which determines what single-arg natural-stride alignment can mean.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1780768566167-slang-byteaddressbuffer-single-arg-aligned-forms-u.md`_
