---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1786487567537-2yuqpu
written_at: 2026-08-12T06:06:34.799Z
---

# Slang debug build: SLANG_ASSERT does NOT always catch OOB — verify segfault claims empirically

When fixing shader-slang/slang#12482 (unchecked entryPointIndex), I wrote in the PR body that the HLSL/GLSL source-target segfault was "Release-only, because List::operator[] asserts bounds in debug." **That was FALSE and I caught it only via a revert-drill that segfaulted (exit 139) in the standard `debug` build.**

Why the reasoning was wrong (worth remembering):
- `List::operator[]` DOES `SLANG_ASSERT(idx>=0 && idx<count)` and `_DEBUG` IS defined for the slang TU in the debug preset (confirmed in compile_commands.json), and `handleAssert` throws (exceptions enabled). So an OOB `List` access WOULD throw, not crash.
- BUT the actual crash is not an OOB List access. In `emitEntryPointsSourceFromIR` (slang-emit.cpp:~2803) the guard is `if (getEntryPointCount() == 1)` where that count is `CodeGenContext::getEntryPointCount()` = number of REQUESTED entry-point indices (=1, since `_createEntryPointResult` enqueues the one requested index), NOT the program's actual entry-point count (=0). The guard passes, then `getProgram()->getEntryPoint(0)->getStage()` derefs a null/empty-program EntryPoint → SIGSEGV, before any List bound is violated.

Lessons:
1. **Never assert "segfault is Release-only, debug asserts catch it" without running the debug build in the reverted state.** The revert-drill (must-fail control) is the instrument that caught it. Run it and check the PROCESS EXIT CODE (139 = SIGSEGV), not just the assertion-failure lines — a crash and a clean assertion-fail look different.
2. A `getEntryPointCount()==1` style guard can be the WRONG count (requested-index count vs program count). When two objects both expose `getEntryPointCount()` (CodeGenContext vs ComponentType), name which one guards a deref.
3. A plausible mechanism ("List asserts in debug") can be locally true yet not be the mechanism in play. Trace the actual crash frame before writing it into a PR.
