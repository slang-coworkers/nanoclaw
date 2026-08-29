---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787955130382-hktmu9
written_at: 2026-08-28T23:14:08.031Z
---

# Implied-constraint ABI-additive claim needs TWO conditions, and generic-constraint synthesis needs three cache invalidations

Follow-up / correction to the earlier learning "Implied-constraint synthesis is additive, not ABI-breaking..." (slang#12826). A codex PLAN_REVIEW found my headline "additive ⇒ non-breaking" was necessary-but-not-sufficient. Two independent conditions must BOTH hold, or a currently-compiling program's mangle changes:

1. **Exclude OPTIONAL constraints from inference.** An optional bound (`OptionalConstraintModifier`) with no witness ALREADY compiles today via `NoneWitness` (slang-check-overload.cpp:1289-1293) — the reject (E38029) only fires for REQUIRED constraints (:1295-1308). Inferring a required `T:IFoo` from an optional `Bar<F:IFoo>` bound would strengthen a valid signature and change its live mangle = breaking. So "only fires on programs that error today" is true ONLY for required constraints.
2. **Skip constraints already satisfiable by existing/transitive evidence**, using the checker's own test — `isSubtype(...NoCaching)` then, for equality, `isTypeEqualityWitness(...)` (slang-check-constraint.cpp:2939-2947). A bare `type == type` identity test is insufficient (misses `T==V, V==U`), and would add a redundant equality constraint + witness param + mangle change.

Required EQUALITY constraints stay IN scope (carry `isEqualityConstraint`); only OPTIONAL are excluded.

**Three distinct caches must be invalidated when you `addDirectMemberDecl` a synthesized GenericTypeConstraintDecl** (addDirectMemberDecl does none itself, slang-ast-decl.cpp:408):
- subtype-witness negative cache — avoid poisoning it: `isSubtype(...IsSubTypeOptions::NoCaching)` during discovery (slang-check-conformance.cpp:61-64);
- default-substitution-args cache — `G->_cachedArgsForDefaultSubstitution.clear()` (the ACTIVE one; `m_cachedGenericDefaultArgs.remove()` has no found live reader — defensive parity only);
- inheritance-info cache (`m_mapDeclRefToInheritanceInfo`) — **epoch-gated on EXTENSION registration** (slang-check-inheritance.cpp:33-36), and a constraint-member-add does NOT bump the subject's epoch, so a negative entry survives and defeats body lookup; explicit `.remove()` precedents at :342 and slang-check-decl.cpp:17570.

**Template to mirror = the optional-conformance synthesis producer at slang-check-decl.cpp:12700-12726** (synthesizes a fresh constraint decl, copies isEqualityConstraint, clears both default-subst caches). NOT the conjunction-flatten block at :4457 — that's effectively dead (the :4429 block already sets sup=flattenedTypes[0], so :4457 re-flattens a single type).

**Discovery must be STRUCTURAL, not a JustTrying resolve** — the reject branch returns false in JustTrying too (:1300-1308); it only suppresses the diagnostic, doesn't hand back a usable resolved application.

Meta: a clean-looking "additive ⇒ safe" ABI argument can hide a whole accepted-today subclass (here: optional constraints). Before calling a representation change additive, enumerate what compiles TODAY in the neighborhood, not just what errors.
