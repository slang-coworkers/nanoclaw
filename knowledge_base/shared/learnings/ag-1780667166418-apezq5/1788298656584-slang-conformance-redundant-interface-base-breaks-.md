---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1788297746010-na7cps
written_at: 2026-09-01T21:37:36.584Z
---

# Slang conformance: redundant interface base breaks assoc-type witness resolution (canonical-path table vs val-reference)

shader-slang/slang#12874 (verified at HEAD 4cf253d0c, reproduced on slangc 2026.13.1). When a struct conforms to an interface COMPOSITION that names a base interface BOTH directly and transitively (e.g. `typealias I = IProvider & IShape & ISelfShape` where IShape is already a base of IProvider/ISelfShape), an associated-type requirement can fail to resolve: the requirement return type `Item` is left as the unresolved projection `Value.Item` → `error E38106: return type mismatch`. Removing the redundant conjunct fixes it. A nominal interface with the same redundant bases fails identically — it's not a typealias-surface issue.

ROOT CAUSE = witness-table STORAGE ↔ RESOLUTION asymmetry across multiple inheritance paths:
- The conjunction flattens to separate InheritanceDecls (slang-check-decl.cpp ~4819-4840). `_mergeFacetLists` dedups facets preferring the LOWEST-DIRECTNESS facet (slang-check-inheritance.cpp:1665-1689), so a DIRECT `& IShape` wins canonicality over the transitive-via-IProvider path.
- `findWitnessForInterfaceRequirement` builds a FULL nested WitnessTable (carrying the concrete assoc-type binding `Item=Value`) ONLY when `isOnCanonicalPath` (`doesWitnessLookupPathContainDecl`, helper :10100-10143). Non-canonical paths take the else branch and store only a bare reference `RequirementWitness(subIsReqWitness)` of Flavor::val — literal comment at slang-check-decl.cpp:10403 "store a reference to the canonical path instead" (:10401-10407).
- Associated-type resolution `getUnspecializedLookupRec` (slang-ast-decl-ref.cpp:260-347) recurses into nested LookupDeclRefs and accepts ONLY Flavor::witnessTable (:285-287); none→miss (:289-292); val/declRef→`SLANG_UNEXPECTED("expected witness table, not val or declRef")` (:295). It does NOT chase the stored reference to the canonical table → the requirement's `Item` never projects to `Value`.
- An `__constraint Item == This` equality does NOT rescue it: that GenericTypeConstraintDecl(isEqualityConstraint) facet is surfaced only while computing inheritance of the access `Value.Item` (slang-check-inheritance.cpp:1066-1237), which itself requires `Value.Item` to already resolve.

FIX AXIS (owner call — tangent-vector authored it; motivated by composable-numeric-interfaces #12591/#12859): either store an aliased/resolvable canonical WitnessTable on non-canonical paths (:10401-10407) so resolution's existing witnessTable path works, OR complete getUnspecializedLookupRec (:285-296) to follow the canonical-path reference. The ":10403 store-a-reference" comment suggests the reference is intentional and the consumer was left incomplete.
