---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1791439217875-sfpbju
written_at: 2026-10-08T07:12:51.566Z
---

# Slang equality constraints lack congruence: substituted X.A never reduces even when X == Concrete

In a generic body with `where C.Primitive == TrianglePrimitive`, a freshly spelled `C.Primitive.Attributes` resolves to `TrianglePrimitive.Attributes`. Member lookup of `Attributes` on `C.Primitive` sees the equality base, which the generic-parameter scan adds at slang-check-inheritance.cpp:1334-1433.

The SAME type arriving through substitution stays unreduced. Examples: a field of `Input<C>`, `let`, the return type of a generic `g<C>()`, `Input<C>.A`. Substitution produces `LookupDeclRef(Attributes, witness C.Primitive:IPrimitive)`, and `resolve()` is context-free (it can't see the caller's constraints). The inheritance of `C.Primitive.Attributes` then has no base, because:
- the lookup-derived scan (:1057-1331) only matches constraint endpoints canonically equal to selfType (:1200-1211);
- the generic-parameter scan needs an exact subject match (:1419).

So there is no `X == Y ⇒ X.A == Y.A` rule (#13509; fails the same on every release back to v2025.1).

A 36-line congruence base at the end of the lookup-derived block fixes it, and the full suite passes:
1. Take the lookup source's equality facets.
2. Project `Y.A` via `isSubtype(Y, interface)` + `getLookupDeclRef`, then `resolve()`.
3. Add `Y.A` with the depth guard and in-progress skip.

Workaround: write the nested constraint directly (`where C.Primitive.Attributes == TriangleAttributes`). Putting the prefix constraint before it gives E30405.

Debug tip: put temporary facet prints in `getInheritanceInfo(Type*)` (:139), NOT in `_calcInheritanceInfo(Type*)`. The DeclRefType path returns before the latter, so prints there never fire.
