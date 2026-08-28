---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787805655972-gyqlgs
written_at: 2026-08-27T09:58:08.560Z
---

# Slang has a reusable cross-block memory-clobber walk: isMemoryLocationUnmodifiedBetweenLoadAndUser

For any CSE / load-reuse / defer-load task that needs "is this load's memory clobbered on the paths between inst A and inst B (across basic blocks)?", Slang already has the canonical primitive — do NOT reinvent it:

`bool isMemoryLocationUnmodifiedBetweenLoadAndUser(TargetRequest* target, IRInst* loadInst, IRInst* userInst)`
- Declared in `source/slang/slang-ir-defer-buffer-load.h:35` (exported, reusable), defined in `slang-ir-defer-buffer-load.cpp:100-209`.
- It requires loadInst DOMINATES userInst. It uses `module->findOrCreateDominatorTree(func)`, then walks predecessors from userBlock back to rootBlock collecting all blocks dominated by rootBlock (handles the loop / userIsOwnPredecessor case), and for every inst in those blocks between the load and the user checks `canAddressesPotentiallyAlias(...)` for stores and treats any other `mightHaveSideEffects()` inst (calls, atomics, barriers) as a conservative clobber → returns false.
- Already reused by TWO callers: `slang-ir-specialize-buffer-load-arg.cpp:98` and the defer-load pass itself. Adding a third consumer is the established pattern.

Supporting layer (all in `slang-ir-util.h/.cpp`):
- `canAddressesPotentiallyAlias(TargetRequest*, func, addr1, addr2)` (util.cpp:1125) — conservative alias oracle keyed on root-address aliasing class.
- `canInstHaveSideEffectAtAddress(func, inst, addr)` (util.cpp:1262) — single-inst predicate: does this inst write/clobber a given address (Store/SwizzledStore alias check, Call arg-aliasing + `doesCalleeHaveSideEffect`, ptr casts, else `mightHaveSideEffects()`).
- `isPointerToImmutableLocation(ptr)` (util.cpp:3104) — a READ-ONLY `StructuredBuffer`/`ByteAddressBuffer`/`ConstantBuffer`/`ParameterBlock`/read-only texture is immutable ⇒ its loads can NEVER be clobbered, so the clobber-walk can be skipped entirely for read-only-buffer CSE. (Exception: OptiX SBT.)
- `isMovableInst(inst)` (slang-ir.cpp:10104) — governs what removeRedundancy dedups; a plain `Load` is NOT movable except ConstantBuffer/ParameterBlock loads and UniformConstant-space GetElementPtr loads (SPIR-V descriptor reuse). A `[__readNone]` pure call IS movable via `isPureFunctionalCall`.

`removeRedundancy` (slang-ir-redundancy-removal.cpp) does cross-block dedup ONLY for movable (never-killable) values: it seeds each dominated child's `DeduplicateContext.deduplicateMap` from its immediate dominator's map (lines 102-106). That inheritance is sound precisely because only pure/movable insts are deduped — extending it to killable resource-loads WOULD require a new clobber-invalidation step (the dominator-map carries no kill info). `tryHoistInstToOuterMostLoop` only hoists movable insts, gated by operand-dominance; hoisting is enabled only in the autodiff fwd path (slang-ir-autodiff-fwd.cpp:2440, `hoistLoopInvariantInsts=true`). `DeduplicateContext`/`IRInstKey` (slang-ir-util.h:41) is purely STRUCTURAL (op+operands) and memory-UNAWARE; the module GVN map (slang-ir.h:2034) is only for globally-hoistable insts (types/consts). Slang has NO memory-aware GVN / available-expressions / MemorySSA / alias-analysis pass today.
