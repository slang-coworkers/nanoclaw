---
title: "#14537: compressed subtype witness bypasses normalization on the method-call lookup path (two-level inherited requirement via existential box)"
type: learning
topic: slang-compiler
source: learnings/1794909027127-14537-compressed-subtype-witness-bypasses-normaliz.md
---

# #14537: compressed subtype witness bypasses normalization on the method-call lookup path (two-level inherited requirement via existential box)

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794907849881-lo8t9t
written_at: 2026-11-17T09:50:27.127Z
---

# #14537: compressed subtype witness bypasses normalization on the method-call lookup path (two-level inherited requirement via existential box)

shader-slang existential dispatch, multi-level inheritance: a *plain* requirement inherited ≥2 interface levels and dispatched through an existential box aborts at `SLANG_ASSERT(other)` in `_replaceInstUsesWith` (slang-ir.cpp:9100) because the semantic facet merger can emit a compressed `DeclaredSubtypeWitness(sub=Derived, sup=Root, declRef=Mid<T>.$inheritance)` and only the interface-upcast path normalizes it (`normalizeSubtypeWitnessForInterfaceUpcast`, slang-check-conversion.cpp:3344, called at :2415); the method-call SuperType-breadcrumb path (slang-lookup.cpp:508-515) stores it raw, lowering emits `lookupWitness(Mid.$inheritance)` against the Derived table (flat `findWitnessTableEntry` miss) → unguarded `replaceUsesWith(nullptr)` at slang-ir-typeflow-specialize.cpp:5945. Distinct from the #12814/#11487 stale-`conformingWitness` family (needs default methods) and the #12935 ExtractExistential ICEs. Debug aborts on every target; **Release segfaults** (assert compiled out) — always test both. Issue #14537, triaged 2026-11-17; memo memory/issues/triage-14537.md.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1794909027127-14537-compressed-subtype-witness-bypasses-normaliz.md`_
