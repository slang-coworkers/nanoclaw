---
title: "slang-test false-green: a unit test that crashes the test-server is reported PASSED (#11751)"
type: learning
topic: slang-compiler
source: learnings/1782398466162-slang-test-false-green-a-unit-test-that-crashes-th.md
---

# slang-test false-green: a unit test that crashes the test-server is reported PASSED (#11751)

**Trust caveat for slang-test greens.** A `slang-unit-test-tool` test that crashes the test-server (JSON-RPC death) on BOTH the initial run and the retry is reported as `passed` / "100% of tests passed" — a false-green. So **test-server unit-test greens are not fully trustworthy** until shader-slang/slang#11751 lands. Repro: `slang-test gfx-unit-test-tool/<test> -use-test-server -server-count 1` against a test that crashes the server.

Root cause (traced at HEAD 1161c3520, tools/slang-test/slang-test-main.cpp): on RPC/connection death `_executeRPC` does `return SLANG_FAIL` WITHOUT writing `exeRes` (`:1194-1203`); `ExecuteResult::init()` left `resultCode=0` and `ToolReturnCode::Success==0`, so `_asTestResult` (`:5522`) maps it to `TestResult::Pass` (`:5637`). `isFailed` correctly captures the rpc failure (`:5639`) but only gates the retry-queue under `!context->isRetry` (`:5664`); on the retry the `else` records `addResult(Pass)` (`:5675`). The rpc failure is never folded into `testResult` — unlike the VVL-debug-layer path (`:5648-5652`) which sets `Fail`. Generalization: not retry-only — also fires under `-disable-retries` and for expected-failure-listed tests. Suggested fixes: `if (SLANG_FAILED(rpcRes)) testResult = TestResult::Fail;` right after `:5637` (idiomatic, mirrors VVL), or set `exeRes.resultCode` to a failure in `_executeRPC` before the `SLANG_FAIL` returns.

**Two related slang-test facts from the same investigation (#11720):**
- **render-test ≠ slangc accepted flags.** A `//TEST(compute):COMPARE_COMPUTE:-vk` runtime lane runs under **render-test** (needs a GPU; different accepted-flag set), NOT slangc. So local `slangc` "passes" do NOT transfer to the runtime lane in CI, and flags like `-warnings-disable` that slangc accepts are rejected by render-test (`error 1004: unknown command-line option`). For a GPU-free regression guard, put the static checks on a `//TEST:SIMPLE(filecheck):-target spirv` lane (slangc, FileCheck the emitted asm) and treat the runtime `COMPARE_COMPUTE` lane as CI-dependent.
- **"slang-test fails only WITHOUT -use-test-server" is frequently environmental, not a Slang bug.** In #11720 the crash that motivated the title turned out to be a graphics-DRIVER issue on the maintainer's machine (resolved by a driver upgrade); the NVVM `Invalid record (Producer LLVM7.0.1 / Reader LLVM 23.0.0)` was a CUDA-toolkit version-skew inside libnvvm (Slang's embedded LLVM is pinned 21.x; NVRTC path is source→PTX with no bitcode I/O), surfaced only by the startup all-backends probe. The durable Slang-side bug from that thread was the false-green harness (#11751), not codegen.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1782398466162-slang-test-false-green-a-unit-test-that-crashes-th.md`_
