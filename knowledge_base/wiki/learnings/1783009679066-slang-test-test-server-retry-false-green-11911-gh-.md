---
title: "slang-test test-server retry false-green (#11911) + gh App-token auth-status false alarm"
type: learning
topic: slang-compiler
source: learnings/1783009679066-slang-test-test-server-retry-false-green-11911-gh-.md
---

# slang-test test-server retry false-green (#11911) + gh App-token auth-status false alarm

Two findings from triaging shader-slang/slang#11911 (unit-test retry silently reports failed tests as passing in test-server mode). Extends the false-green cluster (#11751/#11753 RPC-death, #11856 DeviceCache).

## slang-test unit-test retry false-green (test-server-mode only)
Verified at HEAD 4ed7d3cfc. Two independent defects combine so a deterministically-failing unit test shows "100% passed", exit 0, on per-PR CI:
- **Registry drained between passes.** `runUnitTestModule` calls `testModule->destroy()` after EVERY pass (tools/slang-test/slang-test-main.cpp:5743), clearing the registry (`tests = decltype(tests)();`, tools/unit-test/slang-unit-test.cpp:34). The registry is a process-lifetime `static SlangUnitTestModule` populated ONLY by load-time static ctors (slang-unit-test.cpp:37-40,56-59); the still-loaded module isn't reloaded, so the retry pass sees `getTestCount()==0` (slang-test-main.cpp:5571) and re-runs zero tests. Two-pass driver `for(bool isRetry:{false,true})` at :6028-6055 clears `failedUnitTests` at :6039 before the empty re-run.
- **Unresolved PendingRetry never counted.** `TestReporter::_addResult` early-returns for `TestResult::PendingRetry` with no counter bump (tools/slang-test/test-reporter.cpp:369-374); `didAllSucceed()==m_failedTestCount==0` (:683-685). Nothing reconciles leftover pending → green.

**Why test-server-specific (the key mode puzzle):** the PendingRetry/retry path exists ONLY in the test-server branch of the `runUnitTest` lambda (slang-test-main.cpp:5663-5670). The in-process branch reports a failure DIRECTLY as `addResult(TestResult::Fail)` (:5704,:5712). So an in-process run (coverage nightly, `server-count 1`) counts failures immediately → red, while test-server per-PR CI defers to a retry that never runs → green. File-test retry (:6087-6099) is immune because it re-runs from a saved `failedFileTests` list instead of re-enumerating. **General lesson:** when a failure is "invisible on per-PR CI but visible on nightly," suspect a mode-gated result path (test-server vs in-process), not the test itself.

## gh `auth status` false alarm with GitHub App installation tokens
`gh auth status` printed "The token in GH_TOKEN is invalid" AND exit 0, which looks like a hard auth failure — but actual repo API calls (`gh api repos/OWNER/REPO/issues/N`, posting comments, GraphQL updateIssue) all worked. Cause: the App installation token can't hit the `/user` endpoint that `auth status` probes, so `auth status` mis-reports it as invalid even when repo-scoped calls succeed. **Don't treat a failing `gh auth status` as a blocker** — probe with a real repo API call (e.g. `gh api repos/.../issues/N --jq .state`) before escalating a token problem.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1783009679066-slang-test-test-server-retry-false-green-11911-gh-.md`_
