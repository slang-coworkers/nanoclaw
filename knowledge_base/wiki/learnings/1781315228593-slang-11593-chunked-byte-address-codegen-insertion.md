---
title: "slang #11593 chunked byte-address codegen — insertion point + vector-specific constraint"
type: learning
topic: slang-compiler
source: learnings/1781315228593-slang-11593-chunked-byte-address-codegen-insertion.md
---

# slang #11593 chunked byte-address codegen — insertion point + vector-specific constraint

Triaging slang #11593 (Slice 4/4 of #11545: widest-power-of-two sub-vector chunking for ByteAddressBuffer loads/stores). Concrete codegen facts at HEAD db002dbdf in `source/slang/slang-ir-byte-address-legalize.cpp` for whoever eventually implements:

- **Insertion point.** The vector load decision is in `emitLegalLoad` at :556–572 — `if (scalarizeVectorLoadStore || !isAligned(baseOffset, immediateOffset, alignment, alignmentVal))` → `emitLegalSequenceLoad` (full scalarize) **else** `emitSimpleLoad` (whole-vector fast path, :571). Store mirror: `emitLegalStore` :1508–1519, fast path :1522. Chunking is a NEW additive middle tier *between* the whole-vector fast path and full scalarization; the fast-path guard is untouched.
- **Must be vector-specific.** The full-scalarize fallback `emitLegalSequenceLoad` (:669–716) / `emitLegalSequenceStore` (:1736–1768) is SHARED with the array (:447) and matrix-row (:493) paths. Do NOT add a chunkWidth param to it — chunking is meaningless for array/matrix elements (themselves aggregates legalized recursively). Add new `emitLegalChunkedVectorLoad`/`emitLegalChunkedVectorStore` instead.
- **`chooseChunkWidth` gotcha.** Alignment must be recomputed from the RUNNING byte offset after each chunk, not just the initial alignment. e.g. half4@4 → half2@off0 (align 4) + half2@off4 (align gcd(4,4)=4); float3@8 → float2@off0 (align 8) + scalar float@off8.
- **Building blocks already exist:** `emitSimpleLoad`/`emitSimpleStore` (:747/:1613), `getVectorType`, `emitMakeVector`, `emitElementExtract`, `emitOffsetAddIfNeeded` (:933), `getSizeAndAlignment` (:322).
- **Canonical test to update:** `tests/compute/byte-address-buffer-aligned.slang` — its CHECK2 currently asserts today's per-component scalarized output for sub-aggregate-aligned offsets; chunked output changes that shape.
- **Hard dependency / sequencing.** #11593 is dead code until #11592 (relaxation lets valid sub-aggregate alignments reach codegen) lands, and `chooseChunkWidth` has nothing principled to consult until #11591 (promise-driven predicate; today's `isAligned` only tests the whole vector) lands. Series is jkwak-work's own (COLLABORATOR) — deferential input only, no competing fixer PR.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1781315228593-slang-11593-chunked-byte-address-codegen-insertion.md`_
