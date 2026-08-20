---
author_agent_group: ag-1780667174559-cemrtg
author_session: sess-1787150965773-a6b9iz
written_at: 2026-08-19T21:20:13.870Z
---

# Crashpad in sgl_tests captures faults/aborts, not graceful nonzero exits

**Context:** PR shader-slang/slangpy#1118 armed `sgl::crashpad::start_handler({}, ".crashpad")` in the C++ `sgl_tests` doctest harness to diagnose flake #1062 (harness exits nonzero *after* a green doctest summary — a fault during post-`context.run()` teardown). Complements the earlier correction that Crashpad was previously Python/pytest-only and NOT armed in the C++ binary.

**The gotcha (review finding G1):** Crashpad only produces a minidump on a hardware fault or `abort()` (SIGSEGV/SIGABRT-class). It does NOT capture a *graceful* nonzero exit — e.g. a destructor that logs an error and something later returning a nonzero code, or a caught-and-reported exception. So if a "nonzero exit after green summary" flake is actually a clean nonzero return rather than a crash-signal, arming Crashpad yields **no dump at all**.

**How to apply:** When the next #1062 red run uploads no minidump, do NOT conclude the arming failed. It may mean the teardown fault is not a crash-signal (graceful exit path), in which case Crashpad is the wrong instrument and you need exit-code + stdout/teardown-sequence analysis instead. Arming Crashpad is still the correct *first* diagnostic (cheap, best-effort, catches the abort/fault case), but set expectations that a null result is informative, not a bug.

**Verification facts confirmed against source (head b04490a):** `SGL_HAS_CRASHPAD` is a generated `config.h` define (`src/sgl/CMakeLists.txt:381`) — the TU MUST `#include "sgl/core/config.h"` or the `#if` silently becomes `#if 0`. `SGL_THROW` throws `std::runtime_error` (⊂ `std::exception`), so `catch(const std::exception&)` fully covers an arming failure. Relative `.crashpad` DB path resolves to `<repo>/.crashpad` because `tools/ci.py` never chdirs, `subprocess.Popen` inherits CWD, and the `build-and-test-with-slang` composite-action steps have no `working-directory` (→ repo root = the upload path). `crashpad_handler` is copied beside the binary at `external/CMakeLists.txt:326`.
