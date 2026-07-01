---
title: "slang-test RPC-failure reporting (#11753): 'fails after the fix' ⇒ test-server crash"
type: learning
topic: slang-compiler
source: learnings/1782397269166-slang-test-rpc-failure-reporting-11753-fails-after.md
---

# slang-test RPC-failure reporting (#11753): "fails after the fix" ⇒ test-server crash

When triaging slang-test unit-test failures tied to PR #11753 ("Treat unit-test RPC failures as failures", Fixes #11751) or similar result-reporting changes:

**Mechanism (verified at master HEAD a7fbf1ab0):** `.internal` unit tests run by sending an `ExecuteUnitTestArgs` JSON-RPC call to a separate test-server process. `_executeRPC()` returns `SLANG_FAIL` only on server crash / lost connection / malformed response. In `runUnitTestModule()` (`tools/slang-test/slang-test-main.cpp` ~5631-5644), `isFailed` already included `SLANG_FAILED(rpcRes)` for *retry scheduling*, but the **recorded** per-test result came from `exeRes.resultCode` (== 0 == Pass after `exeRes.init()`). #11753 adds `testResult = TestResult::Fail` inside the `if (SLANG_FAILED(rpcRes))` block so the recorded result is Fail.

**Diagnostic shortcut:** #11753 flips a test pass→fail *only* when the RPC itself failed — it never touches a normally-completing test. So "this test started failing **after** #11753" ⇒ the test is **crashing the test server / failing the RPC**, not a test-logic change. Discriminator in the local output: `rpc failed` / `JSON RPC failure: …` (real server crash) vs a plain `SLANG_CHECK` assertion + non-zero return (would've failed pre-#11753 too).

**"Passes on CI" trap:** #11753 was still an OPEN PR. `master` (what CI runs by default) lacks the fix, so CI **still silently passes an RPC-failing test**. "Passes on CI" therefore does NOT prove the server is healthy on CI — confirm against the **fix PR's own CI run**, not master. General rule: when an open PR changes failure *reporting*, master-CI green is uninformative about the underlying failure.

**Repro recipe (Linux sandbox, Debug build):** `./build/Debug/bin/slang-test slang-unit-test-tool/<name>.internal` (in-process), then `-use-test-server -server-count 1 …` (isolated), then the whole `slang-unit-test-tool/` module via one reused/shared server to surface accumulated-singleton-state crashes. For #11755's three replay/repro tests, all passed cleanly on Linux (462/462 module run) — the failure was local-to-the-reporter (non-Linux platform and/or leftover `.slang-replays`/`SLANG_RECORD_PATH` state). Record/replay infra lives in `source/slang-record-replay/`; repro validator was added by PR #11250.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782397269166-slang-test-rpc-failure-reporting-11753-fails-after.md`_
