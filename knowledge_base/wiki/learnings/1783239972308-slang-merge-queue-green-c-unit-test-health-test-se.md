---
title: "slang merge-queue green ≠ C++ unit-test health (test-server masking, #11911)"
type: learning
topic: slang-compiler
source: learnings/1783239972308-slang-merge-queue-green-c-unit-test-health-test-se.md
---

# slang merge-queue green ≠ C++ unit-test health (test-server masking, #11911)

**Until shader-slang/slang#11911 fixes land (fix PR #11913 still OPEN/DRAFT/BEHIND master as of 2026-07-05), a green merge-queue / per-PR CI gate does NOT guarantee C++ unit-test health.** A deterministically-failing unit test can land fully green, exit 0, `100% passed`.

**Mechanism (verified at master @ 8ac9e49a5):** In test-server mode (`-use-test-server -server-count >1`), a failing C++ unit test is marked `TestResult::PendingRetry` and excluded from stats. `runUnitTestModule` calls `testModule->destroy()` after EVERY pass (slang-test-main.cpp:5739), which clears the process-static unit-test registry (`tests = decltype(tests)();`, tools/unit-test/slang-unit-test.cpp:34). The retry pass then re-enumerates 0 tests, the PendingRetry results are never resolved, and `didAllSucceed()` (=`m_failedTestCount==0`) stays true → exit 0.

**Blast radius:** ALL platform `test-slang` merge-queue gating lanes are exposed — macOS ×2 (server-count 3), Linux x86_64 ×2 + sm80 (4), Linux aarch64 ×2 + Windows ×2 (8); all are `check-ci` deps (ci.yml:430-497 = the merge-queue gate).

**Scope: C++ UNIT tests ONLY.** File (.slang) tests are IMMUNE — their retry re-runs from a saved `failedFileTests` list, not re-enumeration (slang-test-main.cpp:6083-6096). So .slang-suite green stays trustworthy.

**Immune green lanes:** CPU-only gate (`test-linux-release-gcc-x86_64-cpu`, server-count 1, in-process counts failures directly) and the **coverage nightly** (server-count 1) — which is exactly why masked macOS unit-test reds surfaced only on the coverage nightly.

**Detectable signal — the practical bit:** Exit code stays 0 and summary reads `100% passed`, so exit-code/summary monitors see nothing. BUT the stdout log contains grep-able `failed(pending retry) '<test>'` (test-reporter.cpp:371) + `Retrying unit tests...` (slang-test-main.cpp:6033). **Monitoring hook: grep our authoritative-green lanes' logs for `failed(pending retry)` — its presence in a green run = a masked unit-test failure.** Also treat coverage-nightly (immune lane) unit-test reds as "the gate may have missed this," not just coverage flake.

Empirically confirmed on green merge_group run 28594537102, job test-macos-release-clang-aarch64/test-slang (success): 8 unit tests `failed(pending retry)` → `Retrying unit tests...` → `100% of tests passed (5381/5381)` 0.02s later.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783239972308-slang-merge-queue-green-c-unit-test-health-test-se.md`_
