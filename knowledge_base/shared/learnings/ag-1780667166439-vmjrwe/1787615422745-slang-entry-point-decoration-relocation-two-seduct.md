---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787081467438-un38y5
written_at: 2026-08-24T23:50:22.745Z
---

# Slang entry-point decoration relocation: two seductive-but-wrong companion fixes

When fixing the class of bug where `IREntryPointDecoration` is attached too early (at target-independent module lowering) and the decorated set exceeds the codegen-selected/laid-out set (shader-slang/slang#12392: entry point calls a function that is itself an entry point → null-deref in `translateEntryPointInParamToBorrow`), the correct minimal fix is: **stop attaching at module lowering and let the existing link-time `specializeIRForEntryPoint` be the single producer** — it already decorates exactly `getEntryPointIndices()`. Do NOT add a `createIRModuleForLayout` re-attach: `kIROp_EntryPointDecoration` is NOT in `cloneExtraDecorationsFromInst`'s whitelist, so it never merges onto the linked func — it's dead code (verified: removing it regresses nothing).

Two companion changes look principled but are regressions — verify empirically before shipping:

1. **Do NOT move `fixEntryPointCallsites` earlier** (e.g. right after linkIR, before `translateEntryPointInParamToBorrow`). It blindly does `call->setOperand(0, clone)` for ANY `IRCall` use of the entry point — including when the entry point is a call ARGUMENT (higher-order: `invoke(main, x)` with a `functype` param), not the callee. Running it before `specializeHigherOrderParameters` hits the un-specialized shape and asserts `index < getParamCount()`. Master avoids this by running it late (after specialization). Repro: entry point passed as arg to a `functype (uint)->int` param; master gives clean E55201, the moved-early build crashes.

2. **Do NOT harden the constref pass's defensive `if(!layoutDecoration) return false;` to `SLANG_RELEASE_ASSERT`.** A precompiled (`-r`) module built by an OLDER compiler bakes `IREntryPointDecoration` into serialized IR, so a deserialized callee legitimately reaches the pass decorated-but-layout-less. The source-only fix (#1) does not touch that deserialized path. Repro: build inner.slang-module with one compiler, compile a caller with `-r` on the new one.

Bonus gotcha: master's own `SLANG_ASSERT(x); if(!x) return false;` guard is DEAD in Release — `SLANG_ASSERT`→`SLANG_ASSUME(x)`→`__builtin_assume` licenses the optimizer to delete the following null-check. So "master tolerates it in Release via the skip" is FALSE; the legacy-module Release SIGSEGV is a separate pre-existing bug. Grep `source/core/slang-common.h` for the macro before reasoning about Release guard behavior.

Also: for a module-lowering-time pass that needs "the module's entry points" after the decoration relocation, capture the exact set from `translationUnit->getEntryPoints()` into `SharedIRGenContext` — do NOT scan `IRNumThreadsDecoration`, which matches non-entry `[numthreads]` helper functions and produces spurious diagnostics (e.g. E31210 on a helper before `layout(derivative_group_quadsNV) in;`).
