---
title: "slang-test harness false-green fixes: verify behaviorally; Defect-A registry-drain repro is platform-dependent"
type: learning
topic: verification
source: learnings/1783013967417-slang-test-harness-false-green-fixes-verify-behavi.md
---

# slang-test harness false-green fixes: verify behaviorally; Defect-A registry-drain repro is platform-dependent

When fixing a `slang-test` false-green (test-server retry/reporting) bug like shader-slang/slang#11911:

**No committed regression test.** `TestReporter` and `slang-test-main.cpp` compile into the MONOLITHIC `slang-test` executable (tools/CMakeLists.txt `slang_add_target ... EXECUTABLE`), not a reusable library, so a `slang-unit-test` cannot link the harness logic. Precedent #11753 (the sibling crash-as-pass fix) shipped as a 1-line fix + `expected-failure-github.txt` edits, NO test. Verify BEHAVIORALLY: drop a temporary always-failing `SLANG_UNIT_TEST(x){ SLANG_CHECK(false); }` into `tools/slang-unit-test/*.cpp` (sources are globbed → run `cmake --preset default` to re-glob when adding/removing it), build `slang-test`, run `./build/Debug/bin/slang-test -use-test-server -server-count 2 slang-unit-test-tool/<name>.internal`, assert exit != 0 + listed. Remove it before commit (reconfigure again).

**The registry-drain repro (Defect A) is PLATFORM-DEPENDENT.** The bug: `runUnitTestModule` called `testModule->destroy()` after every pass, draining the process-lifetime registry populated only by load-time static ctors, so the retry re-ran 0 tests. On macOS CI (author's evidence) the drained registry stayed empty on the retry. But on the Linux test box, re-introducing `destroy()` did NOT reproduce it — the retry's `loadSharedLibrary` re-populated the registry (static ctors re-ran on reload). So a destroy-based revert-drill can't prove Defect A on Linux, and you can't assert the reload mechanism in the PR (codex will must-fix the overclaim). To prove the Defect-B safety net (reconcile-unresolved-pending-as-fail) is LIVE regardless of platform, temporarily force the retry to run nothing — add `continue;` inside the `if(isRetry){...}` branch after `failedUnitTests.clear()` — then the reconcile fires ("marked pending retry but never re-run") and exit != 0.

**PendingRetry is used by BOTH the unit-test test-server path AND the file-test path** (not test-server-only). A reconcile that fails "any pending not in m_testInfos" must run AFTER both the unit-test retry loop and the file-test retry (before outputSummary), and must union-merge the pending set across parallel sub-reporters in `consolidateWith` (a pending is marked in a pass-1 sub-reporter and resolved in a different retry-pass sub-reporter).

**Draft-PR CI is a priority-yield.** `gh workflow run ci.yml --ref <branch>` on a DRAFT emits a `github.ci_failed` webhook within seconds; the run's only failures are `wait-for-human-priority` + the `check-ci` aggregate, with ALL build/test jobs `skipped`. Benign — do not reproduce/fix; `retry-yielded-bot-ci`/aging reruns it.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1783013967417-slang-test-harness-false-green-fixes-verify-behavi.md`_
