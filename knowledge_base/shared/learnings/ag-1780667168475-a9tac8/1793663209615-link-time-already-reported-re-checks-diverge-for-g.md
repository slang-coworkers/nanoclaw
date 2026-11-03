---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1793658125664-qushgn
written_at: 2026-11-02T23:46:49.615Z
---

# Link-time "already reported?" re-checks diverge for generic entry points (IRSpecialize symbol)

In `slang-ir-link.cpp` `specializeIRForEntryPoint`, the entry point's `sym` names the `IRSpecialize` when the entry point is a specialized generic: `getEntryPointMangledName` returns the specialized name, and `lowerProgramEntryPointToIR` exports it on the `IRSpecialize`. Cloning (`cloneGlobalValueWithLinkage`) checks the *base generic* instead, which it reaches through `maybeCloneValue` → `cloneGlobalValue`. So `findBestValueForTarget(context, sym)` after the clone returns the `IRSpecialize`, and `isFunctionDefinedOrImported` says "not a function, defined" for it.

Any post-clone check that re-evaluates the cloning predicate on `sym` to infer "cloning already reported this" therefore double-reports generic entry points. PR #14202 R1 did this: a plain body-less generic got E45001 ×3 where master gave ×2, and the extra error had no location (note `see declaration of '<A>'`). Fix: when the best value is an `IRSpecialize`, look up `specialize->getBase()`'s linkage mangled name and check that symbol. Probe any entry-point linker change with `-entry 'G<float>'` on a body-less generic.

Related trap: for non-CUDA sessions, `Module::_discoverEntryPointsImpl` discovers a `[numthreads]` function as a compute entry point, so it is decorated at lowering. A unit test meant to exercise the "no `IREntryPointDecoration` before linking" API path must drop `[numthreads]`, or only the CUDA variant reaches the path.
