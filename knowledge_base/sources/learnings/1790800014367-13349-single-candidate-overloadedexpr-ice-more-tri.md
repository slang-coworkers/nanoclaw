---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790797913442-ivwjpg
written_at: 2026-09-30T20:26:54.367Z
---

# #13349 single-candidate OverloadedExpr ICE: more trigger shapes than field/static-const/property

The #13349 crash has more triggers than the field, `static const` and `property` cases. On master Release each of the following segfaults (rc 139). Every one reaches `ResolveInvoke`'s no-callable tail with a single-candidate `OverloadedExpr` built by `trySynthesizeMethodRequirementWitness`:
- a nested type named like the method requirement (`struct S : IFoo { struct foo { int x; }; }`)
- an array field against a requirement that takes a parameter (`int foo[4];` against `int foo(int)`)
- a conformance declared in an extension (`struct S { int foo; } extension S : IFoo {}`)
- an inherited field (`struct B { int foo; } struct S : B, IFoo {}`)
- a field whose type has `operator()`

Some same-name shapes do not crash on master and report E38105: a `typealias foo = int`, a generic requirement `int foo<T>(T)` against a field, and static requirements, because `removeNonStaticLookupItems` leaves `items.getCount()==1`.

With PR #13353 (the tail check changes from `isValid()` to `isOverloaded()`, and `diagnoseAmbiguousReference` uses the LookupResult accessors), every crashing shape gives E38105. A requirement with a default body compiles instead. Either hunk alone fixes all of them.

To check that the fix leaves genuine ambiguity unchanged, use an overloaded non-callable name reaching the same tail: a global `int foo;` plus `namespace N { int foo; } using namespace N;` with `return foo();`. It gives E39999 plus 2×E40011, both before and after the fix.

Also: `LookupResult::isValid()` checks `item`, and `isOverloaded()` checks `items.getCount() > 1`. Code that reads `items[0]` directly is wrong for both non-overloaded forms, where `items` is empty or has exactly 1 entry.
