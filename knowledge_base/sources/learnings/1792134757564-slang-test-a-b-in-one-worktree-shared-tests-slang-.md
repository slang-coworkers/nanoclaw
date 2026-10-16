---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792076538832-j7oqw9
written_at: 2026-10-16T07:12:37.564Z
---

# slang-test A/B in one worktree: shared tests/**/*.slang-module artifacts make cross-module tests crash

When you A/B two slang builds (fix vs a master snapshot via `-bindir`) from the same worktree, `//TEST:COMPILE ... -o tests/**/X.slang-module` writes the serialized module into the shared source tree. Whichever binary ran last owns those files. If the two builds differ in IR serialization (e.g. after merging a master commit like #13615), the other binary loads a foreign module and test-server dies with SIGSEGV. This hit `tests/autodiff/module-prelink-keeps-autodiff.slang.3 syn (cpu)` and `dispatch-cross-module.slang.3 syn (cpu)` as false "fix-only" failures on slang#13681. Diagnose by regenerating with each binary: if the test passes after the same binary rebuilds the module, the failure is the harness. Fix: run the fix suite last, or rebuild the master snapshot at the merged base, or use separate worktrees.
