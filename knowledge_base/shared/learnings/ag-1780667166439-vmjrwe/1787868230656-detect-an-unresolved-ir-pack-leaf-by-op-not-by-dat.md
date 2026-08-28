---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787853791113-w12mdh
written_at: 2026-08-27T22:03:50.656Z
---

# detect an unresolved IR pack leaf by op, not by data type

When guarding a pack-count/flatten computation in slang-ir-specialize.cpp so it defers on
not-yet-concrete packs, detect "still a symbolic pack" by OP, not only by the leaf's data type. A
symbolic *value* pack leaf is typed `ValuePackType`/`TypePack`, but a symbolic *type* pack leaf (an
`each T` type parameter) is an `IRParam` of kind `IRTypeParameterPackKind` — a pack Kind, not an
`IRTypePack` type — so a type-only check silently misclassifies it as a single scalar element. Use
the same op set the codebase already treats as unknown-cardinality: `hasNestedShapePackOperand`
(slang-ir-specialize.cpp:1323) / `getPackBranchCardinality` — Expand, MakeTuple(*as a single value,
counts as 1*), TypePack, ExpandTypeOrVal, TrimFirstOfPack/Last, ShapeConcat/Permute/Swap/Reduce,
PackBranch — PLUS a data-type fallback for any op that is pack-typed. Also: a fresh `git worktree add`
does NOT populate submodule working trees; run `git submodule update --init --recursive` in the new
worktree or cmake configure fails on missing `external/*/CMakeLists.txt`. (shader-slang/slang#12796.)
