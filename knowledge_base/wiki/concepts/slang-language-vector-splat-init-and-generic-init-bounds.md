---
title: "Slang core vector splat init: user implicit conversions, element-type bounds and witness-cost ranking (#14100)"
type: concept
group: slang-language-core
tags: [slang, core-module, vector, splat, __init, __implicit_conversion, implicit-conversion, coercion, _coerce, DeclRefTypeCoercionWitness, __BuiltinScalarType, __BuiltinArithmeticType, overload-resolution, TransitiveSubtypeWitness, computeFinalWitnessCost, OverloadRank, E38203, E55200, E30019, E33070]
source_count: 3
---

# Slang core vector splat init: user implicit conversions, element-type bounds and witness-cost ranking (#14100)

The core module's generic scalar-to-vector splat accepts any source type that has an implicit conversion to the element type, including a user one, and so it can build a vector of vectors or of structs (shader-slang/slang#14100). This page records why the obvious bounds break legitimate conversions, how witness cost decides between a bounded generic init and an explicit-only one, and a check to run before relaying a proposed fix. Conversion-cost caching and the rest of coercion are on [Slang Coercion & Overload Resolution](../concepts/slang-language-coercion-and-overload.md); the general cost-before-rank rule is on [[wiki/concepts/slang-language-core-f0909b0-generics-overload-inference.md]].

## TL;DR

- The splat `__init<FromType>(FromType value) where ToType(FromType) implicit` leaves `FromType` unbounded, and `_coerce` solves the constraint with user `__implicit_conversion` inits too. A user `float ← float3` conversion makes `float4 r = p3;` build `vector<float3,4>` and fail late (E38203/E55200). v2025.5.1 gave a clean E30019; the regression is from PR #6408.
- A generic body cannot call a `where To(From) implicit` constraint (`To(v)` is E33070), so the coercion witness is passed but never used.
- Legitimate traffic shares the splat: scalars with DeclRef witnesses to core `float.$init`, int-enum→int4, float1→float4 (survives only because `legalizeVectorTypes` collapses 1-vectors), bool→float4, int→bool4. "Reject DeclRef witnesses" breaks int→float4; `FromType : __BuiltinScalarType` alone breaks enum and float1; `__BuiltinArithmeticType` excludes `bool` and the packed floats, so a valid-element bound must be at least `__BuiltinScalarType`.
- Witness cost is part of conversion cost: a declared conformance costs 0, each transitive hop 1. Cost is compared before the "prefer `__implicit_conversion`" tie-break, and `_coerce` resolves over all inits before it rejects an explicit-only winner. A bound reached transitively therefore loses to an explicit-only exact-match init, and the implicit conversion fails.
- List a builtin marker directly on each generated base-type struct, never only through a parent marker.
- When bounding a core generic init, probe the source types that have exact-match explicit inits on the target (`int`, `float`); `bool`/`uint`/`int64`/`half` hide the problem.
- To see which init an implicit conversion picked, read the LOWER-TO-IR section of `-dump-ir` for `call specialize(specialize(%init, ToType, N), FromType, %witness)`.
- A fix rule placed in generic inference reads signatures only. Put the culprit's signature next to the rule before relaying it to a fixer.

## The unbounded splat

`core.meta.slang` declares the splat as:

```slang
__generic<ToType, let N:int> extension vector<ToType,N> {
    __implicit_conversion(constraint+) __init<FromType>(FromType value) where ToType(FromType) implicit
    { this = __builtin_cast<vector<ToType,N>>(vector<FromType,N>(value)); }
}
```

`FromType` has no bound, and the coercion constraint is solved through `_coerce`, which accepts user `__implicit_conversion` inits and returns a `DeclRefTypeCoercionWitness`. So `extension float { __implicit_conversion __init(float3) }` makes `float4 r = p3;` build `vector<float3,4>`, which fails late with E38203/E55200; a struct `S` gives `vector<S,4>` the same way. v2025.5.1 gave a clean E30019, so this is a regression from PR #6408.

Three facts limit the fix. A generic body cannot call a `where To(From) implicit` constraint (`To(v)` is E33070), so the witness is passed as a generic argument and never used. Legitimate traffic uses the same splat: scalars with DeclRef witnesses to core `float.$init` (so "reject DeclRef witnesses" breaks int→float4), int-enum→int4 (FromType is the enum, with a builtin witness), and float1→float4, which builds `Vec(Vec(Float,1),4)` and survives only because `legalizeVectorTypes` collapses 1-vectors; `FromType : __BuiltinScalarType` alone therefore breaks enum and float1. And `__BuiltinArithmeticType` excludes `bool` and the packed floats (FloatE4M3/E5M2/BFloat16), while bool→float4 and int→bool4 take this splat, so any "valid vector element" bound must be at least `__BuiltinScalarType` ([check a maintainer's fix-at-inference rule against the culprit](../learnings/1793400114994-check-whether-a-maintainer-s-fix-it-at-inference-r.md)). To see which init an implicit conversion picked, read the first (LOWER-TO-IR) section of `-dump-ir` and look for `call specialize(specialize(%init, ToType, N), FromType, %witness)`; the witness function's body shows a builtin cast or a user init ([vector splat init lets user implicit conversions build nested vectors](../learnings/1793390547913-core-module-vector-splat-init-lets-user-implicit-c.md)).

## A transitive bound can lose to an explicit-only init

`computeFinalWitnessCost` (slang-check-constraint.cpp ~3374) adds `SubtypeWitness::getOverloadResolutionCost()` to a generic candidate's cost: a declared (direct) conformance costs 0, and each `TransitiveSubtypeWitness` hop costs 1 (`kConversionCost_GenericParamUpcast`). `CompareOverloadCandidates` compares `conversionCostSum` before the "prefer `__implicit_conversion`" tie-break, and `_coerce` resolves over all `__init`s of the target, implicit or not, and only then rejects a non-implicit winner. Adding `FromType : __BuiltinScalarType` to the splat therefore made `int -> float4`, `int -> uint4` and `float -> double4` fail (the core module's own `msad4` broke at bootstrap): `int : __BuiltinScalarType` was transitive through `__BuiltinArithmeticType`, cost 1, and lost to the explicit-only `[OverloadRank(-1)] vector<T,N>.__init(int)` at cost 0. The fix lists the marker directly on the generated base-type structs (core.meta.slang ~1187), as every other builtin marker already is. When bounding a core generic init, probe the scalar types that have exact-match explicit inits on the target (`int`, `float`); `bool`/`uint`/`int64`/`half` sources hide the problem ([a transitive subtype witness on a generic bound costs 1 per upcast](../learnings/1793398584078-slang-overload-ranking-a-transitive-subtype-witnes.md)).

## Check that a proposed rule can see the culprit

On #14100 a maintainer proposed a short-term fix in front-end generic inference: constrain a type variable being solved when it appears as a `vector` element type. The culprit init has `FromType` only as a bare parameter type; `vector<FromType,N>` appears only in its body, and inference never reads callee bodies, so a signature-based rule cannot see it. The maintainer corrected course minutes later ("the specific constructor ... wouldn't be addressed by my ramblings about inference"). Before re-planning a fixer on a maintainer's rule, put the culprit's signature next to the rule ([check a maintainer's fix-at-inference rule against the culprit](../learnings/1793400114994-check-whether-a-maintainer-s-fix-it-at-inference-r.md)).

**Source learnings (3):**
- [Core-module vector splat init lets user implicit conversions build nested vectors (#14100)](../learnings/1793390547913-core-module-vector-splat-init-lets-user-implicit-c.md) — unbounded `FromType`; `_coerce` accepts user inits; enum/float1 share the splat; read the LOWER-TO-IR `specialize(%init…)` call.
- [Slang overload ranking: a transitive subtype witness on a generic bound costs 1 per upcast](../learnings/1793398584078-slang-overload-ranking-a-transitive-subtype-witnes.md) — cost before the prefer-implicit tie-break; `FromType : __BuiltinScalarType` lost to the explicit `__init(int)`; list the marker directly.
- [Check whether a maintainer's "fix it at inference" rule can see the culprit before relaying it (#14100)](../learnings/1793400114994-check-whether-a-maintainer-s-fix-it-at-inference-r.md) — inference reads signatures, not bodies; `__BuiltinArithmeticType` excludes bool and packed floats.
