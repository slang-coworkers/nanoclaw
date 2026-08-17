---
title: "slang CI: JSON RPC failure on a unit test = test-server child crash (symptom), not an RPC-infra bug"
type: learning
topic: slang-compiler
source: learnings/1782407732117-slang-ci-json-rpc-failure-on-a-unit-test-test-serv.md
---

# slang CI: JSON RPC failure on a unit test = test-server child crash (symptom), not an RPC-infra bug

# slang-test: "JSON RPC failure: waitForResult()/hasMessage()" on a `*-unit-test-tool/*.internal` test

**Discovered:** triaging shader-slang/slang#11759 (2026-06-25).

**What it means:** With `-use-test-server` (CI default `-server-count 8`), `slang-unit-test-tool` /
`gfx-unit-test-tool` modules run INSIDE a test-server child process. The errors
`JSON RPC failure: waitForResult()` then `hasMessage()` then `rpc failed` / `result code = 0` are emitted by
the PARENT slang-test when the child process **dies mid-test** (the stdio pipe hits EOF →
`source/core/slang-http.cpp` read path returns SLANG_FAIL). So the RPC error is a **symptom of a test-server
crash/abort**, not a bug in the JSON-RPC layer itself. Same signature whether the cause is a crash (fast EOF)
or a timeout (Windows-debug RPC timeout is 5 min, `tools/slang-test/test-context.cpp`) — the EOF/crash path is
the common one when a unit test aborts.

**Why this surfaced now:** PR #11753 (jkwak, Fixes #11751) changed `runUnitTestModule()`
(`tools/slang-test/slang-test-main.cpp:5644`) to set `testResult = TestResult::Fail` when `SLANG_FAILED(rpcRes)`.
Previously a crashed test recorded the stale default `result code = 0` → `Pass`, so crashing unit tests turned
green silently ("100% passed"). The fix UNMASKED pre-existing crashes (e.g. #11759
`parallelGenericEntryPointCompile`, #11755 local replay/repro). Cluster: #11720 (parent) · #11751 · #11755 · #11759;
related closed #10812 "Collect crash diagnostics from test server failures".

**How to apply when you see this signature:**
1. Treat it as "the test crashed the server," not "flaky RPC." Find what the named test does.
2. Repro feasibility ≠ the CI job's OS/GPU. Check the test's actual targets — if it only does *source/IR
   emission* (HLSL/CUDA/SPIRV-asm/Metal `getEntryPointCode`), it's NOT GPU-bound and reproduces on a Linux
   debug build, ideally under ThreadSanitizer for a race.
3. For "parallel*" tests: check whether the test shares frontend objects (one `ISession`/`IEntryPoint` across
   threads doing `specialize`/`createCompositeComponentType`/`link`). Slang's documented concurrency model is
   "serial frontend, parallel backend"; commit #10792 made only the BACKEND thread-safe. A shared-frontend
   stress test may be hitting an uncovered race — and the fix layer (harden compiler vs re-scope test) depends
   on whether shared-session concurrent specialize/compose is a supported contract (#10792/#8119 intent).

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782407732117-slang-ci-json-rpc-failure-on-a-unit-test-test-serv.md`_
