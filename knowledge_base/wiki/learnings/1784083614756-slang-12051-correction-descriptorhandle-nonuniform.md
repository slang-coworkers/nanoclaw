---
title: "slang#12051 CORRECTION — DescriptorHandle NonUniform marker: inst survives, round-trip drops it from heap index"
type: learning
topic: slang-compiler
source: learnings/1784083614756-slang-12051-correction-descriptorhandle-nonuniform.md
---

# slang#12051 CORRECTION — DescriptorHandle NonUniform marker: inst survives, round-trip drops it from heap index

CORRECTION/refinement to the earlier learning "slang#12051 DescriptorHandle divergent NonUniform marker stripped before SPIR-V legalize." The earlier phrasing "-dump-ir shows 0 NonUniformResourceIndex insts / 0 decorations" was IMPRECISE and misleading (a reviewer flagged the -dump-ir load-count blind spot, which prompted re-checking).

PRECISE mechanism (verified at HEAD a8874f6a1e, final-snapshot -dump-ir trace of `Texture2D tex = ResourceDescriptorHeap[NonUniformResourceIndex(tid.x)]`):
```
%33 = swizzle(%32, 0)                  // raw index
%34 = nonUniformResourceIndex(%33)     // marker inst DOES exist here (on the pre-handle uint value)
%35 = makeVector(%34, 0)               // wrapped into the uint2 handle payload
%36 = CastUInt2ToDescriptorHandle(%35)
%37 = CastDescriptorHandleToUInt2(%36) // round-trip
%38 = swizzle(%37, 0)                  // index RE-EXTRACTED — plain swizzle, marker LOST
%39 = getElement(__slang_resource_heap, %38)   // heap access uses UNMARKED %38
```
So: the `nonUniformResourceIndex` inst is NOT globally absent (grep counts are inflated by capability-atom name `nonUniformResourceIndex` in every function's capabilitySet decoration — 166 hits were mostly that noise, plus real insts in OTHER functions). What's true and what the fix relies on: **the heap `getElement`'s index operand is a plain swizzle with NO `NonUniformResourceIndex` wrapper and NO `IRSPIRVNonUniformResourceDecoration`** — the `CastUInt2ToDescriptorHandle`→`CastDescriptorHandleToUInt2` round-trip through handle construction drops the marker before the heap access. Reading `getElement->getIndex()` at SPIR-V legalize therefore sees no divergence signal, which is why a guard there cannot fire (correct conclusion; the earlier evidence wording was just sloppy).

Lesson: when claiming "marker absent," check the SPECIFIC operand (the getElement index), not a whole-dump grep — `-dump-ir` emits every pass snapshot (same function N times) AND capability-atom names collide with inst mnemonics, so raw `grep -c` is unreliable. Trace the actual def chain of the index operand instead.

The follow-up issue for this gap is shader-slang/slang#12110; the fix is PR #12111.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784083614756-slang-12051-correction-descriptorhandle-nonuniform.md`_
