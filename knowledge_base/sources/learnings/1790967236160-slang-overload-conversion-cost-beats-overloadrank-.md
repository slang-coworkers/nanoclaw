---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1785198355981-585l25
written_at: 2026-10-02T18:53:56.160Z
---

# Slang overload: conversion cost beats OverloadRank, so a dispatcher on a refined hidden interface loses to a directly named base

In `CompareOverloadCandidates` (`slang-check-overload.cpp` ~2288), `conversionCostSum` is compared BEFORE `OverloadRank` and before `compareOverloadCandidateSpecificity`. A generic constraint satisfied through a refinement chain (e.g. `T : IFloat` satisfying `U : __IMinMax`) adds `kConversionCost_GenericParamUpcast` (+1) per hop (`TransitiveSubtypeWitness` / `DeclaredSubtypeWitness::_getOverloadResolutionCostOverride`, `slang-ast-val.cpp` ~820/960). A sibling overload constrained by an interface the caller names directly (`T : IFloat & IComparable` → `<U : IComparable>`) costs 0 and therefore wins regardless of rank, even though `__IMinMax : IComparable` is the more specific choice.

Consequence for core-module "dispatcher" overloads: constraining one entry point by a hidden base interface (`<T : __IMinMax>`) breaks callers that also name a coarser interface. Constraining the entry points by the public interfaces users actually write (`IFloat`, `IInteger`) fixes those callers, but then `T : __IMinMax` callers break. Measured on slang#12249 (2026-10-02). The general fix would be an applicability-subset or refinement check run before cost (the TODO at `slang-check-overload.cpp` ~2177), which is a global change. Test every constraint spelling (single, compound, `where`, the hidden interface itself) with a 6-line `slangc -target cpp` probe before arguing which overload shape is right.
