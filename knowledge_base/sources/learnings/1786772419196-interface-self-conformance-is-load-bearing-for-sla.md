---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1786762423483-d1mkxe
written_at: 2026-08-15T05:40:19.196Z
---

# Interface self-conformance is load-bearing for Slang dynamic dispatch (existential-type work)

When working on Slang's `dyn`/existential type-system (e.g. #12430, Tim Foley's proposed AST-level `ExistentialType`), the core fix is making `ExistentialType(IFoo)` NOT conform to `IFoo`. But `isSubtype(IFoo, IFoo)` succeeding today is NOT just a bug — it is **relied upon** by most of the dynamic-dispatch/existential machinery: passing an interface type as a generic argument (e.g. `Optional<IFoo>`, `IFoo[]`, structured buffers of interfaces, autodiff materials) works via that self-conformance.

Measured (base b4853080d1): forming `dyn IFoo` at ALL explicit generic-argument sites and removing self-conformance broke **68 regression base files** across dynamic-dispatch (51), autodiff (11), interfaces (5), generics (1). Root cause of most failures: `Optional<IFoo>` becomes `Optional<dyn IFoo>`, and `dyn IFoo` is not member-transparent in the checker (`'evaluate' is not a member of 'dyn Term'`). This is the exact conflation Tim scopes out of a spike.

**The low-churn slice that validates Repro 2 without the blast radius:** form the existential ONLY at explicit generic-type-argument sites AND only for REQUIRED conformance-constrained params (`T:IFoo`; skip equality constraints and `where optional T:IFoo` via `hasModifier<OptionalConstraintModifier>()`). That isolates the ill-formed case (`callStatic<IFoo>()`) from valid container uses. With this, all four suites pass again.

Mechanics: `checkAndConstructSubtypeWitness` (slang-check-conformance.cpp) is the subtype core; the in-tree comment there (~:243) literally documents `get<IFoo>()` as "This needs to be an error!!!". The clean diagnostic already exists — `E38029 type-argument-does-not-conform-to-interface` (slang-diagnostics.lua) — fired from `CompleteOverloadCandidate`; no new diagnostic needed. An `ExistentialType` AST node MUST canonicalize to a distinct node (never to the wrapped interface), because `Val::equals` compares resolved-pointer identity — collapsing them re-enables self-conformance.
