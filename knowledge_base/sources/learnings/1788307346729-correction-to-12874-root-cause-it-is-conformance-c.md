---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1788297746010-na7cps
written_at: 2026-09-02T00:02:26.729Z
---

# CORRECTION to #12874 root cause: it is conformance-check ORDERING, not the witness-table storage/resolution asymmetry (that was a red herring)

Supersedes my earlier learning "Slang conformance: redundant interface base breaks assoc-type witness resolution (canonical-path table vs val-reference)". After a full fixer investigation (Debug build + instrumented getUnspecializedLookupRec + 3 codex review rounds), the real root cause of shader-slang/slang#12874 is **conformance-checking ORDER**, and the storage↔resolution asymmetry / the getUnspecializedLookupRec `val`-reference / the :353 TransitiveSubtypeWitness gap were all RED HERRINGS (resolution goes straight to the canonical *direct* Value:IShape witness; the witness is always a DeclaredSubtypeWitness, never Transitive).

REAL ROOT CAUSE: resolving an inherited requirement's associated-type return (`IProvider.make(): IShape.Item`) reads the conforming type's CANONICAL IShape witness table. That table is populated by `checkConformance` on whichever InheritanceDecl OWNS the canonical path (owner = `_mergeFacetLists` lowest-directness + decl-order tie-break, slang-check-inheritance.cpp:1665-1689). Bases are checked in DECLARATION ORDER (`checkExtensionConformance`/`checkAggTypeConformance`, slang-check-decl.cpp:11333/11394). If the owning decl is checked AFTER the requirement, its witnessTable is still null → `Item` unresolved (`Value.Item`) → E38106. Silent none-return in getUnspecializedLookupRec (no assert, even under SLANG_ASSERT=system). Empirical proof: reordering the conjunction so the base/owner is listed first flips E38106 → clean compile.

FIX DIRECTIONS (owner's design call — tangent-vector; blocked as of 2026-09-02): TWO viable, NOT one.
1. Canonical-owner-AWARE scheduling — order conformance checking by canonical-witness ownership (owner before consumers). VIABLE (`ICanonical & INeedsShape & IDerived` canonical-first compiles at HEAD). What is UNSOUND is only an *inheritance-DAG-keyed* base-first reorder — it demotes the canonical owner behind a consumer, regressing the diamond `IDerived & ICanonical & INeedsShape` (compiles unfixed, E38106 under the DFS-sort patch).
2. Phased/targeted witness construction — `ensureDecl(sub, ReadyForConformances)` + re-resolve (precedent slang-check-expr.cpp:2818-2831). Caveat: the needed conformance is a SIBLING of the in-progress type, so whole-type ensureDecl(self) mid-check → CyclicReference (or no-op for an already-ready extension target); needs targeted per-conformance readiness.

TRIAGE LESSON: when a redundant/multi-path inheritance bug looks like a witness-table storage/lookup asymmetry, check ORDER-dependence first (cheap: reorder the conjuncts / bases and see if the outcome flips) before hypothesizing a storage or resolver representation fix. An order-flip that changes compile success is decisive evidence the bug is check-scheduling, not representation. And prove any ordering fix against a canonical-owner-demoting diamond counter-example before committing.
