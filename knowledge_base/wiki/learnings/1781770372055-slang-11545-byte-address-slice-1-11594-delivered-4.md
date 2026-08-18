---
title: "Slang #11545 byte-address Slice-1 (#11594) delivered 41302 via constexpr but NOT 41303 — the consistency slice must carry its own location-alignment guard"
type: learning
topic: slang-compiler
source: learnings/1781770372055-slang-11545-byte-address-slice-1-11594-delivered-4.md
---

# Slang #11545 byte-address Slice-1 (#11594) delivered 41302 via constexpr but NOT 41303 — the consistency slice must carry its own location-alignment guard

When a decomposed feature's "validation" slice lands, re-verify WHICH diagnostics actually merged before treating a dependent slice as unblocked — the merged approach can differ from the decomposition plan and silently drop a load-bearing guard.

**Concrete case (2026-06-18):** #11545's ByteAddressBuffer-alignment decomposition put two diagnostics in Slice 1 (#11590): 41302 (`alignment` must be a compile-time constant) and 41303 (a compile-time-constant `location` must be a multiple of `alignment`). The merged Slice-1 PR #11594 ("[1/3] make alignment a compile-time constexpr contract") implemented the contract via a **`constexpr` parameter** on `LoadAligned<T>(uint location, constexpr uint alignment)` (hlsl.meta.slang) — which gives the front-end "expected a compile-time constant" error = the 41302-equivalent ONLY. It added **no 41303-equivalent**: `slang-diagnostics.lua` has only 41300, and grep finds no `location % alignment` check anywhere in master.

**Why it matters:** Slice 2 (#11591 / draft PR #11595) makes the wide-vs-scalarized lowering decision trust the promised `alignment` alone (pure `isWideAccessAligned`, wide iff `promise % accessSize == 0 && immediateOffset % accessSize == 0`). That is only SOUND if a constant `location` contradicting the promise has already been rejected (41303). Without 41303, `LoadAligned<float4>(20, 16)` → `16%16==0 && 0%16==0` → TRUE → wide load emitted at the 16-misaligned offset 20 = a silent miscompile. PR #11595's body literally claims "validated by #11594's 41303" — false against what actually merged.

**How to apply:** For #11591/#11595 specifically, the consistency slice must RETAIN its own 41303 validation (keep the 41303 half of `validateExplicitAlignment` + a 41303 test) rather than dropping it as "redundant with Slice 1." Generally: when a dependent slice cites a sibling's diagnostic by number, confirm that exact diagnostic exists in master (diagnostics.lua + a real check + a test) — a constexpr-parameter contract and an IR-pass diagnostic are NOT interchangeable, and a decomposition's stated slice boundaries are not a guarantee of what merged. Sibling slices: #11592 (Slice 3, reintroduces relaxed 41300), #11593 (Slice 4).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1781770372055-slang-11545-byte-address-slice-1-11594-delivered-4.md`_
