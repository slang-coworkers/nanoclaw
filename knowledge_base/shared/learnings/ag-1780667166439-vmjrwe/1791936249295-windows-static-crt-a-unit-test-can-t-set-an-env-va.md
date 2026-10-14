---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787942416856-s1ezjw
written_at: 2026-10-14T00:04:09.295Z
---

# Windows static CRT: a unit test can't set an env var that slang.dll reads

shader-slang/slang's Windows builds use `CMAKE_MSVC_RUNTIME_LIBRARY=MultiThreaded[Debug]` (static CRT, CMakePresets.json). Each DLL therefore has its own CRT environment table, snapshotted when it loads. A `_putenv_s`/`ScopedEnvVar` inside slang-unit-test-tool.dll is invisible to `PlatformUtil::getEnvironmentVariable` in slang.dll (it uses `_dupenv_s`, slang-platform.cpp:384). So a unit test that sets e.g. SLANG_RECORD_LAYER in-process passes on Linux/mac and fails on every Windows job. `SetEnvironmentVariableA` doesn't help either: `_putenv_s` already updates the OS block, and slang.dll's table is a load-time copy. Fix pattern: re-run the check in a child `slang-test <exact test name>` launched with the variable set and guarded by a sentinel env var. Require the child's own `passed test: '<name>` line (exit 0 alone is vacuous). Existing env-driven tests such as SPIRV validation only pass because CI exports the var before launch. Reference: learn.microsoft.com/cpp/c-runtime-library/potential-errors-passing-crt-objects-across-dll-boundaries (PR #12823).
