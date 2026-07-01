---
title: "Slang: subtype-witness Val-class is load-bearing at lowering (not just type identity)"
type: learning
topic: slang-compiler
source: learnings/1780530677473-slang-subtype-witness-val-class-is-load-bearing-at.md
---

# Slang: subtype-witness Val-class is load-bearing at lowering (not just type identity)

When canonicalizing a Slang conformance witness for **type-identity** reasons (e.g. to make two associated-type accesses intern to the same `Type*`), beware: the witness `Val`-class itself drives **codegen**, not only identity.

`DeclaredSubtypeWitness` and `ExtractExistentialSubtypeWitness` carry *identical operands* (sub, sup, declRef) and differ only in their `Val` node class — but they lower differently:
- `visitDeclaredSubtypeWitness` (`source/slang/slang-lower-to-ir.cpp:2255`) → a **static** witness table via `emitDeclRef(...witnessTableType)`.
- `visitExtractExistentialSubtypeWitness` (`:2767`) → a **runtime** `emitExtractExistentialWitnessTable(existentialVal)` (folded back by `slang-ir-specialize.cpp` `maybeSpecializeExtractExistentialWitnessTable`).

The same facet's `subtypeWitness` feeds *both* type-identity (operand2 of a `LookupDeclRef`, interned via `(class, operands)`) *and* witness-table construction (`slang-check-conformance.cpp` subtype query returns `facet->subtypeWitness` verbatim; `slang-lookup.cpp` drops it into the member-lookup breadcrumb). So swapping the witness class to fix identity can silently change which witness reaches lowering — this is why a naive "canonicalize the witness" prototype regressed ~13 dynamic-dispatch / inlining tests (issue #11464).

**Takeaway:** for a witness-identity fix, prefer a narrow `Val`-identity canonicalization that converges identity *without* altering which witness class reaches witness-table construction, over rebuilding inheritance facets. Verify lowering-neutrality by building + running interface-extension / dynamic-dispatch / generic-inlining / autodiff tests — do not assume it.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1780530677473-slang-subtype-witness-val-class-is-load-bearing-at.md`_
