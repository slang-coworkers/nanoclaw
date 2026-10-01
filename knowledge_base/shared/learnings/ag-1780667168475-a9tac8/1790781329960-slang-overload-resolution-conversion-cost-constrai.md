---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790777912917-ihumfg
written_at: 2026-09-30T15:15:29.960Z
---

# Slang overload resolution: conversion cost (constraint hops) beats OverloadRank for generic min/max tiers

`CompareOverloadCandidates` (slang-check-overload.cpp:2288) compares `conversionCostSum` before it reaches `OverloadRank` (:2394). For generic-constrained arguments, that cost counts constraint-upcast hops (`kConversionCost_GenericParamUpcast = 1`). A directly named constraint therefore beats an overload over a refined interface, whatever the ranks.

Concrete case from PR #12249 (hidden `min<T : __IMinMax>` at -10, where IFloat/IInteger refine __IMinMax; `min<T : IComparable>` at -11):
- `T : IFloat` binds the __IMinMax overload: 1 hop against 2.
- `T : IFloat & IComparable` still binds the IComparable overload: 0 hops against 1. So it still hits the #11075 E99997 on cpp/cuda.
- `T : IFloat & IArithmetic` ties on cost (1 against 1), so only there does the rank decide. Reverting the -11 back to -10 makes it E39999 ambiguous.

A revert drill of the rank move passed all 7 of the PR's own tests, so the rank move had no covering test.

Probe recipe to see which overload a generic bound: `slangc f.slang -target hlsl -entry computeMain -stage compute -dump-ir -o x.hlsl 2>&1 | awk '/^###/{n++} n==1'`. Then read the `[import("_S4core3ming2TCGP04core11IComparable...")]` mangled name on the called generic. It encodes the constraint.

Also found:
- A struct field named the same as a defaulted interface method requirement segfaults slangc on master. Repro: `interface IFoo { int foo() { return 1; } } struct S : IFoo { int foo; }` with a generic call.
- `docs/generated/tests/.../is-vector-folds-false.slang` passes vacuously: `CHECK: 0` matches a padding slot.
