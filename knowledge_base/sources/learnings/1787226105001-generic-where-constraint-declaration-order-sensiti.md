---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787225578542-cl0uk7
written_at: 2026-08-20T11:41:45.001Z
---

# Generic where-constraint declaration-order sensitivity in Slang overload resolution

When triaging bugs where the DECLARATION ORDER of generic `where` constraints changes whether code compiles (e.g. `Storage : IStorage<U>` declared before vs after `U : __BuiltinFloatingPointType`, where `IStorage<U>` itself has `where U:__BuiltinFloatingPointType`), the key sites in the current checkout (`source/slang/`) are:

- **`TryCheckOverloadCandidateConstraints`** (`slang-check-overload.cpp:1157`) is where a CALL to a generic function discharges the callee's constraints. It has TWO paths: (1) a fixpoint worklist solver `trySolveGenericArguments` (used only when `genericIsOutermost`, line 1223/1233) that correctly blocks each witness constraint until dependencies are ready via `hasUnreadyDependenciesForWitnessConstraint` (`slang-check-constraint.cpp:1683`); and (2) a **per-constraint LINEAR pass** (line 1260) that walks `getDecl()->getMembers()` in strict DECLARATION ORDER, accumulating witnesses into `newArgs` — so a constraint processed earlier cannot see witnesses established by a later constraint. The comment at line 1202-1222 explicitly says "The linear pass cannot do this -- it visits constraints once in declaration order" and that nested generics keep the linear pass. This is the prime suspect for order-sensitive failures on NESTED generics.
- The "does not conform" diagnostic is `TypeArgumentDoesNotConformToInterface` (defined in `source/slang/diagnostics/type-errors.lua`, NOT the old `slang-diagnostic-defs.h`). Emit sites: `slang-check-overload.cpp:1303` (linear-pass reject) and `:1598` (solver `InterfaceConformanceNotSatisfied`).
- `checkForwardReferencesInGenericDecl` (`slang-check-decl.cpp:4151`) only tracks type/value PARAMETERS declared before a constraint, not sibling constraints — so it is NOT the ordering bug source.

Note: there is no `slang-check-generic.cpp`; generic where-constraint checking lives in `slang-check-decl.cpp` (`visitGenericTypeConstraintDecl` at line 4400, `visitGenericDecl`, `checkGenericConstraintConformances` at line 11561) and `slang-check-constraint.cpp` (the worklist solver). PR #11210 consolidated solving into the monolithic worklist; #11368 made it order-agnostic — but only on the outermost-generic solver path, not the nested linear fallback.
