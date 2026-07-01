---
title: "Recursive witness-table walks need a cycle guard — autodiff creates self-referential witness tables"
type: learning
topic: slang-compiler
source: learnings/1780769202792-recursive-witness-table-walks-need-a-cycle-guard-a.md
---

# Recursive witness-table walks need a cycle guard — autodiff creates self-referential witness tables

# Any recursive walk over witness-table-valued entries in Slang IR MUST have a visited-set / cycle guard

**The non-obvious invariant.** Slang's autodiff `buildDifferentiablePairWitness` (`source/slang/slang-ir-autodiff.cpp:491-494`, and the Ptr variant at `:563-566`) deliberately creates a **self-referential** witness-table entry: it stores the enclosing table itself as the satisfying value for `differentialAssocTypeWitnessStructKey`:

```cpp
builder->createWitnessTableEntry(
    table,
    sharedContext->differentialAssocTypeWitnessStructKey,
    table);                 // satisfyingVal == the enclosing table
```

So the premise "nested witness tables form an acyclic tree" is **false** in well-formed IR. Any helper that recurses into `as<IRWitnessTable>(entry->getSatisfyingVal())` without a `HashSet<IRWitnessTable*>` visited set will infinite-loop / stack-overflow the moment it's called with a key absent from such a table (the miss case is exactly when recursion descends). The autodiff helper `_lookupWitness` (`slang-ir-autodiff.cpp:25-36`) encodes the safe contract: it searches *direct entries only* and `SLANG_UNEXPECTED`s on a miss.

**Where this surfaced.** shader-slang/slang#11487 (P1 segfault, inherited default interface method through dynamic dispatch). The fix added `findWitnessTableEntryInInheritanceClosure` in `slang-ir-util.cpp` — a DFS over nested base-interface witness tables. Round-1 review caught that the first version had **no** cycle guard → reachable infinite recursion whenever autodiff (`DifferentialPair`/`IDifferentiable`) is combined with dynamic dispatch. Round-2 fix added a static recursive impl + `if (!visited.add(table)) return nullptr;` public wrapper; verified clean against the autodiff sweep (365/365).

**Second-order trap in the same fix (correctness, not termination):** recursing into *arbitrary* witness-table-valued entries also descends into **associated-type** conformance tables, not just base-interface inheritance entries — both are lowered as `RequirementWitness::Flavor::witnessTable` (`slang-lower-to-ir.cpp:10554-10601`). Requirement keys are globally unique per requirement decl (one `IRStructKey` per decl, `getInterfaceRequirementKey`), which is what makes a first-match DFS *correct* — but only because of that global uniqueness. If that invariant ever weakens, the walk could return the wrong nested table (silent miscompile). A reviewer should always check: does the recursion's correctness rest on key-uniqueness, and is that stated where the walk is defined?

**How to apply (for reviewers).** When reviewing any new recursive traversal of witness tables / conformance tables in Slang IR: (1) demand a visited set or a proof of acyclicity — and remember autodiff breaks acyclicity; (2) check whether the walk descends into assoc-type tables it shouldn't, and whether correctness silently depends on global key-uniqueness; (3) the cycle guard's *only* purpose is termination on the autodiff self-edge, so it needs its own test (a `SLANG_UNIT_TEST` building a self-edge table + missing key, asserting null-without-hang) — a non-autodiff `.slang` regression test will pass even if the guard is later deleted.

**Reviewer-process note.** Running Reviewer A (correctness) and Reviewer C (clarity) on the same small patch produced tight 1:1 convergence: A's "1 Bug, 2 Gaps, 2 Questions" mapped onto C's candidate set, with C reframing several correctness findings as clarity/contract issues (e.g. the cycle bug → "termination invariant unstated" + "name says InheritanceClosure but body is first-match DFS"). Convergent A∩C items are higher-confidence than either alone; C-only items (cross-pass coupling between `lowerGetTagForMappedSet` and the typeflow analyze skip-on-miss; the new `return false` outcome class; void-conformance short-circuit reachability) were signal, not noise — three survived to round 2.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1780769202792-recursive-witness-table-walks-need-a-cycle-guard-a.md`_
