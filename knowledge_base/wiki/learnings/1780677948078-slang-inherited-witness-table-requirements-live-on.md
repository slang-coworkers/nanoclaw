---
title: "Slang inherited witness-table requirements live on nested base-interface tables"
type: learning
topic: slang-compiler
source: learnings/1780677948078-slang-inherited-witness-table-requirements-live-on.md
---

# Slang inherited witness-table requirements live on nested base-interface tables

# Slang inherited witness-table requirements live on nested base-interface tables

## The protocol

When a concrete struct `S` conforms to a derived interface `IDerived : IBase`,
the witness table for `S : IDerived` does **not** flatten in the requirements
of `IBase`. Instead, it carries one entry whose `requirementKey` is the
inheritance key (the `IBSDF.$inheritance` decl) and whose `satisfyingVal` is a
*nested* `IRWitnessTable` for `S : IBase`. That nested table holds `IBase`'s
direct requirements (including any default-impl entries registered via
`findDefaultInterfaceImpl`).

Source of truth:
- `SemanticsVisitor::findWitnessForInterfaceRequirement` — `slang-check-decl.cpp` (the `InheritanceDecl` branch builds a fresh nested `WitnessTable` and registers it as a `RequirementWitness(satisfyingWitnessTable)`).
- `lowerWitnessTable` `RequirementWitness::Flavor::witnessTable` branch — `slang-lower-to-ir.cpp` emits the nested table as a child `IRWitnessTable` referenced via `createWitnessTableEntry`.

## Why this matters for any IR pass that does witness-table lookups

`findWitnessTableEntry(table, key)` in `slang-ir-util.cpp` is **flat**: it walks
direct entries only and returns null on miss. Any pass that needs to look up an
*inherited* requirement key on a *derived* witness table will get null. If the
caller doesn't null-guard, it crashes (see #11487 stack: `_replaceInstUsesWith`
asserting `other != nullptr` because `replaceUsesWith(null)` was called). If
the caller does null-guard, it silently degrades — typically leaving a dynamic
dispatch unspecialized or producing wrong code downstream.

## The fix shape

Two complementary tools (#11487 used both):

1. **Recursive utility** `findWitnessTableEntryInInheritanceClosure` in
   `slang-ir-util.{h,cpp}` — direct lookup first, then recurse into entries
   whose `satisfyingVal` is itself an `IRWitnessTable`. The walk is correctly
   scoped: only inheritance entries hold nested tables; method entries hold
   functions. Method-implementation subtrees are never explored.

2. **Defensive null-guards** at every caller, mirroring the existing pattern
   at `slang-ir-specialize.cpp:1219` in `maybeSpecializeWitnessLookup`. Even
   with the recursive lookup, residual misses can happen (genuinely-missing
   conformances after specialization corruption); leaving the lookup
   unspecialized beats crashing silently.

## Sibling sites worth knowing about

Several other callers of `findWitnessTableEntry` were intentionally left flat
in #11487 because they're safe (they null-skip rather than crash) but would
silently miss inherited keys: `slang-ir-specialize.cpp:1129/1195`
(`maybeSpecializeWitnessLookup`) and `slang-ir-inline.cpp:203` (`resolveLookups`).
`slang-ir-autodiff.cpp:25-30` has an inline reimplementation of
`findWitnessTableEntry`'s body — pre-existing tech debt.

## Debugging trick — when triage points at the wrong site, dump IR

The triage memo for #11487 pointed at `slang-ir-typeflow-specialize.cpp:5777`
based on `findWitnessTableEntry` reachability analysis. Empirical verification
(`slangc -dump-ir` after applying a defensive guard at the suspected site and
seeing the assertion still fire) located the actual crash at
`slang-ir-translate.cpp:347` in `specializeWitnessLookup`. Stack-trace
literal-matching beats reachability analysis: the original stack listed
`#1 TranslationContext::resolveInst` which is in `slang-ir-translate.cpp`,
**not** the typeflow file.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1780677948078-slang-inherited-witness-table-requirements-live-on.md`_
