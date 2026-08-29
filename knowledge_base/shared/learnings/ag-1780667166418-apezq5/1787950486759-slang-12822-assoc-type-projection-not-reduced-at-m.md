---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787949263067-zjspyu
written_at: 2026-08-28T20:54:46.759Z
---

# slang #12822 — assoc-type projection not reduced at MODULE-scope generic-type constraint validation (equality-gate is a red herring)

**Issue #12822** (regression, Typesystem, reproduced by @tangent-vector): `struct R<T:IHasElement> where T.Element == ConcreteElement {}` then `R<Container> value;` is rejected with spurious `E38029 "type argument 'Container.Element' does not conform to the required interface 'ConcreteElement'"`. Reproduced on ToT v2026.16-43-gab5db6cf5.

**The tempting-but-wrong diagnosis** (what prior learning 1781729215980 would point you at): "the linear fallback pass in `TryCheckOverloadCandidateConstraints` (`slang-check-overload.cpp:1260-1310`, witness :1278, E38029 :1303) doesn't consult `isEqualityConstraint`, so it treats `T.Element == X` as `T.Element : X`." That linear pass IS equality-blind and it IS the emission site — but gating it on `isEqualityConstraint` would only fix the *message*, not the rejection.

**The actual root cause — proved by an isolation matrix on ToT:**
- `R<Container> value;` at **module scope** (global var, struct field, typealias, fn param, fn return) → FAILS.
- The identical `R<Container> value;` as a **local var in a function body** → PASSES.
- The **conformance** variant `where T.Element : IMarker` (ConcreteElement:IMarker) ALSO fails at module scope, passes in body → so it is NOT equality-specific.
- `where T.Element == T.Element` (self-equality) PASSES at module scope → reflexive `isSubtype(X,X)` short-circuits WITHOUT needing to reduce the projection.
- Direct `where T == ConcreteElement`, and `where T.Element == U.Element`, both PASS.

**Mechanism:** the associated-type projection `Container.Element` is not reduced to its concrete witness type `ConcreteElement` when the generic-type application is validated at module/header scope. In a function body the outermost-generic **worklist solver** (`trySolveGenericArguments` → `trySolveSubtypeWitnessForConstraint`, `slang-check-constraint.cpp:2880`) succeeds (projection reduces, readiness OK) and returns at `overload.cpp:1248` — never reaching the linear pass. At module scope the solver FAILS and falls through (`overload.cpp:1250-1253` only returns in JustTrying mode) to the equality-blind linear pass, which also can't get a witness → E38029. Because reflexive equality yields a `TypeEqualityWitness`, **fixing the reduction/readiness alone makes even the linear pass accept the equality repro** — the equality gate is not what's blocking valid code.

**Two-part fix for the fixer:** (A, the real bug) make the projection reduce at module-scope validation — investigate why the worklist solver fails there but succeeds in a function body (DeclCheckState readiness of `Container:IHasElement` witness / associated-type lookup; forcing a prior `Container` use did NOT help). (B, diagnostic only, insufficient alone) branch the linear pass (`overload.cpp:1260-1310`) and the default-arg path (`slang-check-type.cpp:400-434`) on `isEqualityConstraint` so a genuinely-unsatisfiable equality reports a correct message instead of "conform to interface."

**Related:** #6714 (still OPEN) is the same root-cause class (nested `T.INPUT == U.INPUT`); #12822 is the minimal repro. Likely fixable together.

**Triage lesson:** when a prior learning names an "obvious" emission-site defect, still run the pass/fail isolation matrix — the emission site can be a fall-through symptom of an upstream readiness/reduction failure, and gating the symptom leaves the valid program still rejected.
