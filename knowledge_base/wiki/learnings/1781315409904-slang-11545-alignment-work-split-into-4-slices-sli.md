---
title: "slang #11545 alignment work split into 4 slices; Slice 3 (#11592) only partially blocks on Slice 1"
type: learning
topic: slang-compiler
source: learnings/1781315409904-slang-11545-alignment-work-split-into-4-slices-sli.md
---

# slang #11545 alignment work split into 4 slices; Slice 3 (#11592) only partially blocks on Slice 1

The #11545 ByteAddressBuffer alignment redefinition was decomposed (confirmed by @jkwak-work) into 4 tracked sibling issues: **#11590 Slice 1** (validate alignment/location up front — adds 41302 "alignment must be compile-time const" + 41303 "const location must be multiple of alignment", a single validation entry point in `slang-ir-byte-address-legalize.cpp` before the legal-type early-out, NO codegen change), **#11591 Slice 2** (independent), **#11592 Slice 3** (pow2 41301 + 41300 relaxation + `getNaturalAlignment` op/`__naturalAlignmentOf<T>` intrinsic + single-arg forwarder switch), Slice 4 (chunked widest-access codegen — point 5, lands last).

**Non-obvious sequencing (triaged #11592 at HEAD db002dbdf):** Slice 3 only PARTIALLY depends on Slice 1. Two halves:
- **Diagnostic half (41301 + 41300 relaxation)** — BLOCKED on Slice 1: shares the validation entry point, which does NOT exist on master yet (today all alignment validation is incidental, deep inside `isAligned` `slang-ir-byte-address-legalize.cpp:243-285`; 41300 emitted `:278-282`, keyed off the wide-load `alignmentVal`, not scalar-component size).
- **Natural-alignment infra half (`getNaturalAlignment` op + intrinsic + peephole fold + switching 12 single-arg `*Aligned` forwarders)** — FULLY INDEPENDENT of Slice 1; can start immediately. Touches `slang-ir-insts.lua:1265`, `core.meta.slang:3856-3865`, `slang-ir-peephole.cpp:1761-1786`, `hlsl.meta.slang` (RO loads :291/368/445/491, RW :6247/6324/6401/6470, stores :7043/7087/7132/7159), `slang-ir-use-uninitialized-values.cpp:25`, `slang-ir-insts-stable-names.lua`.

**Two gotchas for the fixer:**
1. New IR op stable name (`slang-ir-insts-stable-names.lua`) must take the NEXT FREE number (862 at this HEAD — max in file is 861), NOT declaration order (getNaturalStride is 269, but you don't get 270).
2. `__naturalAlignmentOf<T>` per the spec = "largest power of two dividing T's natural stride" — a DERIVED computation, NOT the `IRSizeAndAlignment.alignment` field. They coincide for vectors but DIFFER for aggregates (stride-24 struct → largest-pow2-div = 8, while scalar/natural alignment = 4). Implement the spec; confirm with @jkwak-work.

**Ownership unchanged:** @jkwak-work (core team) authored the decomposition and was implementing the foundation on fork PR jkwak-work/slang#250 — don't open a competing public PR without coordination.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1781315409904-slang-11545-alignment-work-split-into-4-slices-sli.md`_
