---
title: "sgl_tests exit-code flake: maintainer rejected exit-code masking; root-cause path required"
type: learning
topic: ci-tooling
source: learnings/1783937217747-sgl-tests-exit-code-flake-maintainer-rejected-exit.md
---

# sgl_tests exit-code flake: maintainer rejected exit-code masking; root-cause path required

Follow-up to the #1062 sgl_tests teardown/exit-code flake (draft PR #1064). The `std::_Exit(result)` fix (bypass post-`main` teardown so exit code == doctest status) passed coworker peer review but was **rejected by maintainer @skallweitNV** with `CHANGES_REQUESTED`: he accepts the `std::fflush`, but "strongly disagree[s] with the return code handling — not a good idea to hide potential issues during shutdown."

**The rule this confirms:** for a C++ test-harness teardown/exit-code flake, maintainers reject any fix that *masks* the exit code (`_Exit(result)`, ci.py tolerance parsing, try/catch-and-swallow) — because it suppresses ALL post-`main` teardown signals, so a genuine static-destructor/shutdown bug would be hidden alongside the timing flake. This was the exact cost the original triage flagged as "A(b)'s tradeoff." Don't lead with the masking fix; it will bounce.

**The path that survives the constraint (masks nothing):** diagnose-then-root-cause.
1. **Arm crash capture in the C++ binary.** `sgl_tests` never arms crashpad today — `start_handler()` (`src/sgl/utils/crashpad.cpp`) is called only from the Python pytest side (`slangpy/testing/plugin.py`); the harness's `sgl::testing::static_init()` (`tests/sgl/testing.cpp`) is empty. So the intermittent teardown crash produces NO minidump — CI shows only "green doctest, exit 1," nothing to root-cause. Wire static_init → start_handler so the next occurrence is stackwalkable. NOTE: the fault is *post-`main`* (global/static destructors, DLL unload), so in-`main` phase-bracketing or try/catch can't reach it — crashpad (out-of-process) is what catches it.
2. **Then fix the real faulting step.** Prime suspect: `sgl::static_shutdown()` (`src/sgl/sgl.cpp:48-71`) already documents this class (Python ref-cycles → slang-rhi resources unreleased → "crash in Vulkan validation layers during process termination") and calls `Device::_release_all_rhi_resources()` as a PARTIAL workaround. Recurrence on nvrgfx Windows = that workaround is incomplete.

Interim cost the maintainer must weigh: without a stopgap, the false red recurs (~20d cadence) until root-caused.

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783937217747-sgl-tests-exit-code-flake-maintainer-rejected-exit.md`_
