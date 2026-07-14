---
title: "sgl_tests exit-code flake root cause + tracking issue #1062"
type: learning
topic: ci-tooling
source: learnings/1783930954720-sgl-tests-exit-code-flake-root-cause-tracking-issu.md
---

# sgl_tests exit-code flake root cause + tracking issue #1062

The `sgl_tests` teardown/exit-code flake (green doctest, `[doctest] Status: SUCCESS!`, then process exit 1 → `RuntimeError` from `tools/ci.py` run_command → red cross-repo **SlangPy Tests** check) is now tracked at **shader-slang/slangpy#1062** (filed 2026-07-13, labels CI+bug).

**Root cause, verified in source:** `tests/sgl/sgl_tests.cpp` `main()` captures `result = context.run()` (:55, =0 when all pass), then runs **UNGUARDED teardown** — `sgl::testing::static_shutdown()` (:57), `sgl::Device::close_all_devices()` (:60 → GPU/CUDA resource destruction, `src/sgl/device/device.cpp:526`), `sgl::static_shutdown()` (:62, `src/sgl/sgl.cpp:48`) — before `return result` (:64). A native crash in that teardown exits the process nonzero though `result==0`. Note `src/sgl/sgl.cpp:55-60` **already documents this crash class** (Python ref-cycles → slang-rhi resources not released → "crash in Vulkan validation layers during process termination") with `Device::_release_all_rhi_resources()` as a partial workaround — recurrence means it's incomplete on the self-hosted nvrgfx Windows runner. run_command raise is at `tools/ci.py:100` (older reports cited :143 — version drift, mechanism unchanged).

**Provenance gotcha:** the "#11680" in older babysitter logs is a **mis-shorthand** — #11680 is an unrelated MERGED slang PR (UTF-8 diagnostic carets), 404s in slangpy; the flake was merely first *observed* on that slang PR's downstream check, never a tracking issue. "Fix (b)" was a 06-22 discussion, not a filed/authorized plan. Two confirmed occurrences (slangpy runs 27965567210 06-22, 29232873855 07-13).

**Fix direction:** SGL harness layer (make exit code reflect test status) preferred over ci.py tolerance. First step for any fixer: stackwalk the captured crashpad minidump to pin the exact teardown fault frame. HARD CONSTRAINT: a real test failure (result!=0) and any mid-test crashpad capture must still red the job — don't mask real crashes.

Do NOT conflate with the DIFFERENT flake in triage-994 (pytest-xdist Python worker SIGABRT in a Vulkan test, `unit_test_python` — that's #994).

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1783930954720-sgl-tests-exit-code-flake-root-cause-tracking-issu.md`_
