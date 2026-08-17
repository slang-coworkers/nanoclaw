---
title: "slang #11590 — 41303 can't live in validation-only slice-1; simplifyIR folds the implicit alignment operand before legalize"
type: learning
topic: slang-compiler
source: learnings/1781318517600-slang-11590-41303-can-t-live-in-validation-only-sl.md
---

# slang #11590 — 41303 can't live in validation-only slice-1; simplifyIR folds the implicit alignment operand before legalize

**Context:** shader-slang/slang #11545 was decomposed (confirmed by @jkwak-work) into 4 slices; slice-1 (#11590) was scoped as "validate alignment/location up front (diags 41302 + 41303), no codegen change, single entry point in slang-ir-byte-address-legalize.cpp before the legal-type early-out, lands first." Triaged 2026-06-13 at HEAD db002dbdf.

**Finding (proven by IR dump, decisive):** at the mandated single legalize entry point, the implicit single-arg `LoadAligned<T>(location)` form's alignment operand is **already a folded `IRIntLit`**, indistinguishable from an explicit user promise. The producer forwards `__naturalStrideOf<T>()` (hlsl.meta.slang:491; Load2/3/4Aligned naturals at :291/:368/:445); `kIROp_GetNaturalStride` is folded to a literal by the peephole inside `simplifyIR` (slang-ir-peephole.cpp:1761), and `simplifyIR` runs at slang-emit.cpp:1249/1451/1519/1571/1758 — **all before** `legalizeByteAddressBufferOps` (:1936). Dump: `LoadAligned<float3>(16)` → `byteAddressBufferLoad(%buf, 16, 12)` (op2=folded stride 12) vs explicit `LoadAligned<float4>(4,8)` → `(%buf, 4, 8)`.

**Consequence:**
- **41302** ("alignment must be compile-time constant") is slice-1-SAFE: the folded literal passes; only a genuinely dynamic explicit alignment trips it. No regression.
- **41303** ("const location multiple of alignment") is NOT slice-1-safe. For N∈{1,2,4} natural stride==natural alignment (pow2), fine; for **N=3** (float3/int3) stride=12 but true natural alignment=4, so a slice-1 41303 would falsely reject valid `LoadAligned<float3>(16)` (16%12≠0) — code valid in master AND in the final design. The memo's "exempt the implicit form by opcode" branch is impossible (no GetNaturalStride opcode survives to the pass).

**Resolution (triager ruling, Option A):** ship **41302 in slice-1**; couple **41303 with slice-3** (slice-3's `__naturalStrideOf→__naturalAlignmentOf` producer fix makes the forwarded alignment real, so 41303 becomes correct). Rejected: a synthesized-operand *marker* in slice-1 (Option B) — it lives in slice-3's files and slice-3 deletes it → throwaway band-aid, violates "do not mask." Slice-2's "depends on 41303" dependency shifts to depend on slice-3. **Why:** the regression cure is fixing the producer (root cause), not adding a guard so a premature check can run. The decomposition change is the maintainer's call → surfaced to jkwak via a 41302-only DRAFT PR ("Part of #11590", not "Fixes") + issue comment asking him to confirm.

**How to apply:** when a "validation-only, before codegen" slice for ByteAddressBuffer alignment is proposed, remember the implicit natural overloads inject a folded stride as the alignment operand — any location%alignment check at/after the legalize pass will mis-fire on 3-component vectors unless the producer has already been fixed to forward true natural alignment. Validation that needs the implicit/explicit distinction cannot live at the post-simplifyIR legalize entry point.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1781318517600-slang-11590-41303-can-t-live-in-validation-only-sl.md`_
