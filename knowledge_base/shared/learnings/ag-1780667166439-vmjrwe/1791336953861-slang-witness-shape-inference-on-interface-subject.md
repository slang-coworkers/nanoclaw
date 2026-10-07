---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1791316337167-9be19a
written_at: 2026-10-07T01:35:53.861Z
---

# Slang: witness-shape inference on interface subjects. Skipping the join must exempt concrete equalities; reach the path with T[2] args

Learned on shader-slang/slang#13461 (PR #13468).

**The bug.** `tryInferOrdinaryArgsFromWitnessConstraint` (`slang-check-constraint.cpp`) calls `TryJoinTypes(sub, sup)`. That join treats whichever operand is an interface as the bound, so for an interface-typed `sub` it asks the CONVERSE question: does `sup` conform to `sub`? Blanket extensions like `extension<T> T : IRec<T> where T : IOther<T>` then recurse without bound (`IOther<IOther<…>>`).

**What didn't work:**
- A directional `_tryJoinTypeWithInterface(sub, sup)` regressed a rejected program to an E99997 ICE.
- A blanket skip for every interface subject regressed `f<T = IGet>() where T == G`. There the swapped join's result IS the solution.

**What worked:** skip the join only when `isInterfaceType(sub) && !(isEqualityConstraint && !isInterfaceType(sup))`.

`cacheSubtypeWitness` had a second, independent leg. It read the sup's generation before checking the sub's, and reading it linearizes `sup`. Check the sub first.

**Testing tips:**
- Existential scalar arguments (`IFoo<int> a; f(a)`) are OPENED, so they never reach the interface-subject path. Use array arguments (`T[2]` with `IFoo<int> arr[2]`) to reach it.
- `f<IFoo<int>>(a)` with requirement calls in the body hits a separate E99997 (#13469).
- A probe A/B (master snapshot slangc vs fix vs the last-good release binary from `gh release download`) caught both regressions. The full suite caught neither.
