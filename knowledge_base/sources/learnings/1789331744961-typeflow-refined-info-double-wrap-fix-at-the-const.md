---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789325371322-b21c9o
written_at: 2026-09-13T20:35:44.961Z
---

# Typeflow refined-info double-wrap: fix at the construction chokepoint, and producer can supersede a consumer PR (slang#13046 vs #12934/#12935)

## Context
slang#13046 ICE `Unhandled info type in analyzeExtractExistentialType` (typeflow specialization). Same crash family as #12934 (whose in-flight PR #12935 is a *consumer-side* singleton guard). Root cause: `isConcreteType` has no tagged/untagged-union case → returns true → an already-lowered `IRTaggedUnionType` return gets re-lifted by `makeInfoForConcreteType` into the malformed `UntaggedUnion(TypeSet(TaggedUnion(...)))`.

## Two transferable lessons (both surfaced/confirmed by the codex critique loop)

1. **When the fix is "don't re-wrap an already-refined X", put the guard at the single CONSTRUCTION CHOKEPOINT, not at the caller — and NOT as an assert.** First attempt guarded the `propagateInterproceduralEdge` fallback and added `SLANG_ASSERT(!isRefinedInfoType(type))` at `makeInfoForConcreteType`'s entry. That is INCOMPLETE: a *structurally-nested* refined return (`IAccessor[1]`, tuple, `DifferentialPair<...>`) passes `isConcreteType` at the top level, enters `makeInfoForConcreteType`, and the structural recursion hits the refined element → the assert HARD-ABORTS (reproduced with an `IAccessor[1]` variant). Correct fix: `if (isRefinedInfoType(type)) return type;` at the TOP of `makeInfoForConcreteType`. Because the structural cases recurse back through the same function, one guard at the chokepoint covers top-level AND arbitrarily-nested cases for free. This matches the existing `tryGetInfo` rule ("refinement occurred in a previous phase; reuse directly") — canonical handling, not masking. `isRefinedInfoType` = {TaggedUnionType, UntaggedUnionType, ElementOfSetType} (same op set tryGetInfo/isSingletonInfo already use — consolidate to one predicate).

2. **A producer-side fix can SUPERSEDE a consumer-side PR for a whole crash family — verify by running the sibling issue's own regression on your fix.** #12935's consumer guard fixes #12934 but *relocates* #13046 (its singleton branch fires on the malformed singleton and re-asserts downstream at `slang-ir-specialize-function-call.cpp:246`). Conversely the producer fix here compiles+passes #12934's OWN regression test with NO consumer guard present → it fixes both at the root. Before recommending "companion PR", run the related issue's test on your build; if it passes, recommend supersede (and carry that test forward so coverage isn't lost — no path collision since only one PR lands). Aligns with codebase philosophy and the #11667 precedent (maintainer preferred fixing the classifier over a consumer helper).

## Meta
The incomplete-assert gap (lesson 1) and the supersede opportunity (lesson 2) were BOTH caught by the codex CODE/PLAN critique before delivery — worth running the critique gate on IR-pass fixes even when local tests are green, because a targeted repro (top-level) can miss the structural-nesting variant.
