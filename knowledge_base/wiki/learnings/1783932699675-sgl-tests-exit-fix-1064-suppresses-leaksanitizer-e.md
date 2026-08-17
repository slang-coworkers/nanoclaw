---
title: "sgl_tests _Exit fix (#1064) suppresses LeakSanitizer end-of-run report — non-blocking, ASAN is OFF in CI"
type: learning
topic: ci-tooling
source: learnings/1783932699675-sgl-tests-exit-fix-1064-suppresses-leaksanitizer-e.md
---

# sgl_tests _Exit fix (#1064) suppresses LeakSanitizer end-of-run report — non-blocking, ASAN is OFF in CI

The #1062 fix (`std::fflush(nullptr); std::_Exit(result)` in `tests/sgl/sgl_tests.cpp` main(), PR #1064) has one non-obvious side effect not mentioned in the fixer's reasoning: `_Exit` bypasses the C-runtime `atexit` phase, which is exactly where LeakSanitizer/ASan runs its **deferred end-of-run leak summary**. So an `SGL_ENABLE_ASAN=ON` build of `sgl_tests` loses its leak report at exit.

**Why it's non-blocking:** ASAN is `option(SGL_ENABLE_ASAN ... OFF)` at `CMakeLists.txt:68`, and CI never enables it (verified: no `-fsanitize`/`SGL_ENABLE_ASAN` in `.github/workflows/`, `tools/ci.py`, or `CMakePresets.json`). ASan's *immediate* error reports (use-after-free, buffer overflow) still fire mid-run and abort BEFORE `_Exit` — only the deferred leak summary is lost, and only in a manually-enabled local ASAN build.

**Verdict shape for this class of "bypass CRT teardown" fix:** APPROVE_WITH_NITS, gap = "note the ASAN-leak-report interaction in the PR body." If local-ASAN dev ever matters, guard the `_Exit` behind an ASAN-enabled compile define; otherwise leave unconditional.

**Doctest exit-code plumbing confirmed (answers the "does a real failure still red?" question):** `Context::run()` returns `EXIT_FAILURE` iff `p->numTestCasesFailed && !p->no_exitcode`, else `EXIT_SUCCESS` (doctest.h `cleanup_and_return`). `tools/ci.py:106-107` `run_command` raises RuntimeError on any nonzero returncode — matches failing run 29232873855's "SUCCESS! then RuntimeError + exit 1" signature. `_Exit(result)` propagates verbatim, so failures still red.

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783932699675-sgl-tests-exit-fix-1064-suppresses-leaksanitizer-e.md`_
