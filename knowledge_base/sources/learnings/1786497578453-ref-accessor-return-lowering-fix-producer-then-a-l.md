---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1786484172954-01b3wv
written_at: 2026-08-12T01:19:38.453Z
---

# ref-accessor return lowering: fix producer, then a latent addr-space worklist loop cascades

## Context
shader-slang/slang#12487 / #9636: a `property`/`__subscript` `ref` accessor aborted Metal emit ("Unknown addressspace"), produced invalid SPIR-V, and silently lost writes on HLSL/GLSL/WGSL.

## Root cause (producer, one bug)
In `slang-lower-to-ir.cpp`, a `RefAccessorDecl`'s IR func result type is set to `Ptr(T)` (`_lowerInfoFromFuncParameters`, ~:4805), but `visitReturnStmt` (~:8837) had NO ref-accessor case: `return _v;` took the ordinary value path `emitReturn(getSimpleVal(...))`, and `getSimpleVal` on an l-value emits a LOAD → body returns `T`, contradicting the `Ptr(T)` type. (`set` is void-special-cased; `ref` was missed.)

Fix: add a branch in `visitReturnStmt` — when `context->funcDecl` is a `RefAccessorDecl`, `lowerLValueExpr` the return expr and `emitReturn(getAddress(context, lvalue, expr->loc))` (returns the field ADDRESS). Reuses the existing `getAddress`/`tryGetAddress(Aggressive)` helper; `getAddress` already diagnoses a non-l-value body (`InvalidLValueForRefParameter`). Place the branch AFTER the `returnDestination` and `constructorDecl` early-returns.

## The CASCADE (the non-obvious part)
Making the ref helper genuinely return a pointer exposed a LATENT INFINITE LOOP in `specializeAddressSpace` (`slang-ir-specialize-address-space.cpp`). Symptom: with only the producer fix, `-target metal` and `-target spirv` HANG (C++/CPU + HLSL/GLSL emit fine — only the two backends that run `specializeAddressSpace` loop). Root cause: `HashSet<IRFunc*> newWorkList` was declared OUTSIDE the `while (workList.getCount())` fixpoint loop and never cleared, so once any func's result addr-space changed (`processFunction` returns true → callers queued), `workList` was refilled with the same already-converged callers every round → never terminates. Fix: move `newWorkList` INSIDE the loop. Never hit before because no user-reachable function returned a pointer whose result addr-space got specialized from Generic — the ref accessor is the first.

## Lessons
- A correct producer-side fix that changes an IR shape can expose latent loops/asserts in downstream passes that never saw that shape. Always verify EMIT on every affected target, not just that lowering looks right — the earliest IR dump looked perfect while Metal/SPIR-V hung.
- A hang localizes fast via `-dump-ir` under `timeout`: the last `### AFTER <pass>:` marker names the pass that runs next (the culprit). Here: last marker `lowerBufferElementTypeToStorageType` → next pass `specializeAddressSpace` (order confirmed in slang-emit.cpp).
- Out-of-scope sibling: a NON-copyable ref-accessor element type aborts `paramCount == callArgCount` (`slang-ir-constexpr.cpp`) on master too — different root (`maybeAddReturnDestinationParam` makes it `void`+`out T` but the accessor call site omits the arg). Don't conflate; #12487/#9636 use copyable `int`.
