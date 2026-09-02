---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1788298600904-jzyrll
written_at: 2026-09-02T00:00:10.066Z
---

# slang conformance-order bugs (assoc-type E38106): reordering base conformances is unsound — the dep is canonical-witness ownership

When an inherited interface requirement's signature references an associated type of a base
interface (e.g. `IProvider : IShape` with `static Item make()` → `IShape.Item`), resolving it reads
the conforming type's **canonical** witness table for that base. If the inheritance decl owning that
canonical conformance is checked AFTER the requirement, its `witnessTable` is null → the assoc type
stays unresolved (`T.Item`) → **E38106** (silent none-return in `getUnspecializedLookupRec`, NO
assert). This is issue #12874's root cause; it's a conformance-checking ORDER bug, NOT the
transitive-witness gap (#12134) and NOT the stored non-canonical `val` reference — both are off the
failing path.

**Trap (cost me several build cycles + 3 codex rounds):** the "obvious" fix — reorder a type's base
conformances base-interfaces-first (topological sort by the inheritance DAG) — is **UNSOUND**. It
fixes #12874 but REGRESSES cases like `IDerived & ICanonical & INeedsShape` (IDerived:INeedsShape;
ICanonical, INeedsShape:IShape): unfixed compiles it, but a base-first reorder demotes the canonical
`IShape` owner `ICanonical` behind the consumer → E38106. The real dependency is canonical-witness
**ownership** (directness + declaration-order tie-break, computed independently of check order), not
the sibling inheritance DAG — so a DAG-keyed sort orders the wrong thing. Note a canonical-**owner**-
aware order is NOT ruled out (`ICanonical & INeedsShape & IDerived` compiles).

**Correct direction:** phased / on-demand witness construction — build the needed canonical
base-interface table before a requirement reads it. Precedent for the analogous "signature fold ran
before the witness table was built" case: **slang-check-expr.cpp:2818-2831** uses
`ensureDecl(sub, DeclCheckState::ReadyForConformances)` + re-resolve. Caveat: can't be lifted
verbatim — if the needed conformance is a SIBLING of the in-progress type, `ensureDecl(self,
ReadyForConformances)` mid-check emits `CyclicReference` (or no-ops if already ready); needs
*targeted per-conformance readiness*.

**Debugging tip:** to trace which resolver branch/terminal fires, add env-gated fprintf
(`getenv("SLANG_T12874")`) in `getUnspecializedLookupRec` + `findWitnessForInterfaceRequirement`;
print `witness->toString()` and `decl->getName()->text`. A Debug build with `SLANG_ASSERT=system`
tells you assert vs clean-none-return terminal instantly. And confirm a suspected regression by
`git stash`+rebuild-unfixed at the SAME commit, not just the older prebuilt.
