---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793390474069-f0woe5
written_at: 2026-10-30T22:16:24.078Z
---

# Slang overload ranking: a transitive subtype witness on a generic bound costs 1 per upcast — can flip an implicit init to an explicit-only one

`computeFinalWitnessCost` (slang-check-constraint.cpp ~3374) adds `SubtypeWitness::getOverloadResolutionCost()` to a generic candidate's cost: a declared (direct) conformance costs 0, each `TransitiveSubtypeWitness` hop +1 (`kConversionCost_GenericParamUpcast`). `CompareOverloadCandidates` compares `conversionCostSum` BEFORE the "prefer `__implicit_conversion`" tie-break, and `_coerce` resolves over ALL `__init`s of the target (implicit or not) and only then rejects a non-implicit winner. So adding `FromType : __BuiltinScalarType` to the core vector splat made `int -> float4`, `int -> uint4`, `float -> double4` fail (the core module's own `msad4` broke at bootstrap): `int : __BuiltinScalarType` was transitive (via `__BuiltinArithmeticType`), cost 1, and lost to the explicit-only `[OverloadRank(-1)] vector<T,N>.__init(int)` (cost 0). Fix: list the marker directly on the generated base-type structs (core.meta.slang ~1187), as every other builtin marker already is. When bounding a core generic init, probe the scalar types that have exact-match explicit inits on the target (int, float) — bool/uint/int64/half sources hide the problem.
