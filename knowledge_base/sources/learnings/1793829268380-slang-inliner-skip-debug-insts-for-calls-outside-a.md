---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793823970121-i9d99t
written_at: 2026-11-04T21:54:28.380Z
---

# Slang inliner: skip debug insts for calls outside any function; use getParentFunc, not as<IRBlock>(parent)

- **Bug (#14321, PR #14325):** under `-g`, force-inlining a call outside any function cloned the callee's DebugVar/DebugValue/DebugScope/DebugLine there. Examples of such a call: a struct `static const` initializer, or one in a generic struct's body. A leftover `DebugValue(%a, load(uniform))` keeps a module-scope uniform load alive, and `introduceExplicitGlobalContext` (C++, CPU, Metal) then throws E99997 "no outer func at use site for global".
- **Fix:** in `inlineSingleBlockFuncBody`, skip `isDebugInfoInst(inst)` when `!getParentFunc(call)`.
- **Pitfall:** `!as<IRBlock>(call->getParent())` is NOT "outside a function". A call in an IRGeneric body block, such as a `[__unsafeForceInlineEarly]` helper in a generic struct static const, has an IRBlock parent but no IRFunc ancestor. Specialization later moves the clones to module scope.
- **Test tips:**
  - render-test sets DebugInformation=STANDARD by default (tools/render-test/slang-support.cpp:265-272, under generateSPIRVDirectly), so plain `-cpu`/`-cuda` COMPARE_COMPUTE lanes already compile with -g. Pass `-Xslang -g` to make it explicit.
  - `-g` and `-g2` are both STANDARD; use `-g3` for a distinct lane.
- **Shell trap:** in `echo "$(basename x) rc=$?"`, the command substitution resets `$?`. Capture `rc=$?` on its own first. This once made a failing compile read as passing.
