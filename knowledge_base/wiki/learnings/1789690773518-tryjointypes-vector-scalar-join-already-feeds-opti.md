---
title: "TryJoinTypes vector/scalar join already feeds optional-constraint solving (slang#13158)"
type: learning
topic: slang-compiler
source: learnings/1789690773518-tryjointypes-vector-scalar-join-already-feeds-opti.md
---

# TryJoinTypes vector/scalar join already feeds optional-constraint solving (slang#13158)

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789665613390-mqaivk
written_at: 2026-09-18T00:19:33.518Z
---

# TryJoinTypes vector/scalar join already feeds optional-constraint solving (slang#13158)

In Slang's generic inference, `SemanticsVisitor::TryJoinTypes` (slang-check-constraint.cpp) is called both for ordinary-argument common-type merges AND for reconciling constraints *discovered while solving optional `where` clauses* — they share the `mergeTypeConstraint` code path.

Key verified fact: the **vector↔scalar** join arm (`TryJoinVectorAndScalarType`) runs **unconditionally** inside `TryJoinTypes` (not behind any flag). Consequence: "join incorporating implicit conversions" already participates in solving a type parameter across optional constraints, today, with no enum involved.

Empirical proof (any recent build):
- `struct S : IA<float>, IB<float3>` passed to `pick<T,U>(T) where optional T:IA<U> where optional T:IB<U>` **type-checks**, solving `U = float3` (the join reconciles float+float3).
- Truly unrelated `struct S : IA<Foo>, IB<Bar>` **fails** with `E30442: conflicting requirements 'Foo' and 'Bar'` (no join → U unsolvable).

So when adding an enum→tag decay to `TryJoinTypes`, the enum case for `IA<E>, IB<int>` sits between those two — the decay makes it behave like float/float3 (solves U=int) rather than Foo/Bar (fails). Adding enum to the join does NOT introduce the join↔solver-over-optional-constraints coupling; it only widens the set of types the pre-existing coupling covers. Whether implicit-conversion joins *should* solve a parameter across optional constraints at all is a separate, pre-existing design question (raised by tangent-vector on PR #13160), orthogonal to enums.

Takeaway for reviewers/fixers: a flag that gates an enum arm of `TryJoinTypes` at the ordinary-arg merge site cannot, by itself, keep the new behavior out of the constraint solver — witness-discovered optional constraints re-merge through the same path. Verify the widening scope empirically with an `IA<X>, IB<Y>`/optional-`where` probe, not just by reading the flag's call site.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1789690773518-tryjointypes-vector-scalar-join-already-feeds-opti.md`_
