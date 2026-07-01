---
title: "Slang ByteAddressBuffer implicit LoadAligned<T>(offset) passes STRIDE as alignment (non-pow2 for vec3)"
type: learning
topic: slang-compiler
source: learnings/1781030980541-slang-byteaddressbuffer-implicit-loadaligned-t-off.md
---

# Slang ByteAddressBuffer implicit LoadAligned<T>(offset) passes STRIDE as alignment (non-pow2 for vec3)

The single-arg `[RW]ByteAddressBuffer.LoadAligned<T>(uint offset)` / `StoreAligned<T>(uint addr, T value)` (hlsl.meta.slang:489/6407/7096) pass `__naturalStrideOf<T>()` as the *alignment* argument to `__byteAddressBufferLoad/Store`. `__naturalStrideOf` (core.meta.slang:3857, intrinsic `kIROp_GetNaturalStride`) returns the layout STRIDE = `N·sizeof(scalar)` (rounded), which is NOT the same as the type's natural ALIGNMENT.

Critical distinction (source: `slang-ir-layout.cpp:688-690`): a 3-component vector's natural *alignment* is the element size (e.g. float3 → 4 bytes, pow2), but its *stride* is 12 (non-pow2). So passing stride-as-alignment over-claims alignment for vec3 and yields a non-power-of-two alignment — the root of the "3-component legality issue" in #11505 (WGSL asserts pow2 alignment at slang-emit-wgsl.cpp:318). For vec2/vec4, stride == alignment, so only odd/3-component counts diverge.

Consequences worth remembering:
- For N∈{1,2,4}, stride is always pow2 (every built-in scalar size is 1/2/4/8 = pow2); for N=3 it never is — true for ALL scalar types, not just uint.
- The templated Load/Store/LoadAligned/StoreAligned forms have NO `where T` constraint today (fully generic over scalar/vector T); the underlying `__byteAddressBufferLoad<T>` intrinsics (hlsl.meta.slang:5834) are unconstrained too. So "templated forms only support uint" is FALSE.
- #9958 (error 41300, slang-diagnostics.lua:4877) is the OPPOSITE problem — alignment *too small* (sub-natural) on the EXPLICIT `LoadAligned<T>(off,align)` form. The implicit form passes ≥sizeof so never triggers it. Two distinct alignment legality issues — don't conflate.

To restrict a generic to {1,2,4}-component vectors: no native value-set constraint exists, but use a marker interface + per-shape generic extensions (scalar, vector<T,2>, vector<T,4>; omit vec3) + `where T : IMarker`. Precedent: ITexelElement conformance at hlsl.meta.slang:618-628.

**Why/how to apply:** when triaging or fixing ByteAddressBuffer alignment behavior, the stride-vs-alignment conflation is the likely root cause of non-pow2-alignment bugs for odd-component vectors — fixing the implicit form to pass natural alignment (not stride) is a candidate fix that preserves vec3, vs. restricting the type set.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1781030980541-slang-byteaddressbuffer-implicit-loadaligned-t-off.md`_
