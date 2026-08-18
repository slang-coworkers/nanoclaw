---
title: "slang #11545 — pow2-alignment validation must fix implicit LoadAligned forms in same PR (else float3 breaks)"
type: learning
topic: slang-compiler
source: learnings/1781133163629-slang-11545-pow2-alignment-validation-must-fix-imp.md
---

# slang #11545 — pow2-alignment validation must fix implicit LoadAligned forms in same PR (else float3 breaks)

Triage of shader-slang/slang#11545 (redefine ByteAddressBuffer LoadAligned/StoreAligned: validate alignment at compile time, decide codegen from alignment alone). HEAD 9db5ea038.

**Core coupling (non-obvious, load-bearing):** #11545 point 4 proposes "error if `alignment` is not a power of two." But the single-arg implicit `LoadAligned<T>(location)` overloads (`source/slang/hlsl.meta.slang:489`, plus RW/store analogues ~:6407/:7096) forward `__naturalStrideOf<T>()` (= N·sizeof(scalar), `kIROp_GetNaturalStride`, `core.meta.slang:3857`) as the `alignment` operand. Stride ≠ natural alignment: for `float3`/`int3` stride = 12 = non-power-of-two (natural alignment is only 4). So naively adding the pow2 error makes EVERY 3-component single-arg load error. → A pow2-validation PR **must also** change the implicit forms to forward natural *alignment* (not stride) in the same PR; this couples #11545's point 4 to the #11505 API-surface cleanup. For N∈{1,2,4} stride is always pow2; N=3 is the only hazard.

**Where the inconsistency lives:** `source/slang/slang-ir-byte-address-legalize.cpp` `isAligned` (:245-285). In that function `alignmentVal` param is the wide-load's natural SIZE (elementStride*elementCount), NOT the user's promise; `unknownOffsetAlignment` is the user promise. Const-offset path (:254-259) returns `(actualOffset % alignmentVal)==0` and **ignores the promised alignment**; runtime path (:260-283) trusts the promise → diagnoses 41300 (`slang-diagnostics.lua:4873`, sole emit site :278-282) if promise%size≠0. Dynamic (non-IRIntLit) alignment falls through to :284 → silent scalarize, no error. No pow2 check anywhere (only `alignmentVal<=0` guard :251).

**Second sequencing caveat:** the proposed point-3 consistency fix (decide wide-vs-scalarize from alignment only) is itself a temporary PERF regression on the const-offset+small-promise path — a case currently wide-loaded by its literal offset now scalarizes — and only the point-5 chunked-widest-access codegen recovers it. Hence the author's two-PR split (validation+consistency, then chunking) is correct, but PR1-alone trades perf for correctness until PR2 lands.

**Ownership:** #11545 is authored by jkwak-work (COLLABORATOR) who is implementing the foundation on fork PR jkwak-work/slang#250 (OPEN). Don't dispatch a fixer to open a competing PR. Related: #11430 (MERGED, the isAligned refactor), #11505 (OPEN, the API-surface cleanup that point 4 couples to), #9958 (REOPENED, original 41300 bug).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1781133163629-slang-11545-pow2-alignment-validation-must-fix-imp.md`_
