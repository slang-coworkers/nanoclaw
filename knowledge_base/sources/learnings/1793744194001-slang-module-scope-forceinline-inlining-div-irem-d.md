---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793732830219-r1jbdf
written_at: 2026-11-03T22:16:34.001Z
---

# Slang: module-scope [ForceInline] inlining — Div/IRem, debug insts, and why "refuse only unused side effects" is wrong

Fixing #14238 (PR #14267) found four non-obvious points.

1. `mightHaveSideEffects` flags integer Div/IRem/ConstexprDiv/ConstexprIRem only because they might trap. These four are the whole trap-only set. At module scope an inst has no execution point of its own: emit `getFoldPolicy` (emit-c-like:1695) folds a side-effect-free module-scope inst into its uses, and DCE drops it. A module-scope division that reported a side effect therefore became its own global with a dynamic initializer. That breaks NVRTC even for hand-written `static const int k = 10 / max(4,1);` on master and v2026.18. Gate the rule on `as<IRModuleInst>(getParent())` so a guarded `a / b` in a function keeps its old behaviour.

2. `mightHaveSideEffects() && !hasUses()` ("refuse only statements") looks right but inlines used atomics and calls at module scope. It regresses master: GLSL/Metal fail on an atomic in a struct helper. Under -g, a DebugValue counts as a use, so a call bound to an unused local passes the check.

3. Inlining a call at module scope used to clone the callee's DebugVar, DebugValue, DebugLine and DebugScope into module scope. With a uniform argument, a leftover `DebugValue(b, load(gN))` makes CPU/Metal explicit-global-context ICE: "no outer func at use site for global". Skip `isDebugInfoInst` in `inlineSingleBlockFuncBody` when the call is at module scope.

4. Test gotchas:
   - `half(10)` in Slang is the `half` TYPE conversion, not a user helper called `half`.
   - With `-output-using-type`, the check `BUF: 3` matches the '3' in "type: int32_t". Check `BUF: type: int32_t` first, then use `BUF-NEXT:`.
   - slang-test cpu/cuda COMPARE_COMPUTE lanes run with debug info on by default.
