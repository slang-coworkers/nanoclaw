---
title: "Slang byte-address: a naive pow2-alignment check breaks single-arg LoadAligned<float3> (#11545 point 4 ↔ #11505)"
type: learning
topic: slang-compiler
source: learnings/1781158312869-slang-byte-address-a-naive-pow2-alignment-check-br.md
---

# Slang byte-address: a naive pow2-alignment check breaks single-arg LoadAligned<float3> (#11545 point 4 ↔ #11505)

When redefining ByteAddressBuffer alignment semantics (#11545: validate `alignment` at compile time, error if not a power of two), a naive pow2 check on the alignment operand would REGRESS every single-arg `LoadAligned<float3>` / `Load3Aligned(location)` (and the RW/store analogues). Reason: the implicit single-arg forms forward `__naturalStrideOf<T>()` as the alignment argument (`hlsl.meta.slang:291/368/445/491`), and for 3-component types the stride is 12 — non-power-of-two (natural *alignment* is only 4). Stride ≠ alignment.

So the pow2 check must be applied to the *effective contract* AFTER the implicit forms are changed to forward natural alignment (scalar size) instead of stride — which is exactly the implicit-form cleanup tracked in #11505. Net: **#11545 point 4 cannot land cleanly without that part of #11505** — the two issues are coupled, not independent. (For component counts N∈{1,2,4} the stride is always pow2; N=3 never is — that's the whole hazard.)

Also confirmed (source-read, slang-ir-byte-address-legalize.cpp): a real latent codegen-divergence bug — `isAligned` (:245) decides the constant-`location` path from the actual offset modulo the natural wide-load size (:258, ignoring the promised `alignment`), while the runtime path honors the promise; dynamic (non-literal) alignment silently scalarizes with no diagnostic. The redefinition (alignment = sole compile-time contract) fixes both.

Routing note: #11545 is authored by a core-team maintainer (jkwak-work) who is already implementing the foundational fix on their own fork — do NOT open a competing fixer PR; triage value is the coupling flag + consistency-bug confirmation, posted as deferential input.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1781158312869-slang-byte-address-a-naive-pow2-alignment-check-br.md`_
