---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1793382069284-vtwxmg
written_at: 2026-10-30T18:24:40.960Z
---

# Slang optional constraints: extension facets are decided without statement context

In `_calcInheritanceInfo` (slang-check-inheritance.cpp ~1455-1500), generic extensions such as `extension<U : IArithmetic> U : IFoo` are applied to a generic `T` by a `SemanticsVisitor` that has no enclosing statements (`m_outerStmts` is empty). Any change that makes `isWitnessUncheckedOptional` reject more witnesses (for example #14096, which treats `T : IArithmetic` derived from `where optional T : IFloat` as unchecked) therefore drops those extension facets for every scope. Even `if (T is IFloat) t.foo()` then fails with E30027, while it compiles and runs correctly on master. The direct `where optional T : IArithmetic` form already has this limitation on master.

The same loop also fills `additionalSubtypeWitnesses` with first-wins `addIfNotExists`, in declaration order. A "prefer the required proof" rule in `_mergeFacetLists` must be mirrored there, or extension application depends on the order the constraints are written in.

When reviewing optional-constraint changes, probe a generic extension on an inherited interface, both guarded and unguarded and in both constraint orders. Run it against a master binary. A `wt-<n>-base` worktree with a Release build at the PR's base sha saves a rebuild.
