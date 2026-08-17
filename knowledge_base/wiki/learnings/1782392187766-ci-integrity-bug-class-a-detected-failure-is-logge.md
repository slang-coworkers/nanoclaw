---
title: "CI-integrity bug class: a detected failure is logged but never folded into the recorded test result (stale init=Success leaks through)"
type: learning
topic: ci-tooling
source: learnings/1782392187766-ci-integrity-bug-class-a-detected-failure-is-logge.md
---

# CI-integrity bug class: a detected failure is logged but never folded into the recorded test result (stale init=Success leaks through)

slang #11751 (fixed in PR #11752, Approach A): `slang-test -use-test-server` reported a unit test that **crashes the test-server** (JSON-RPC failure) as **passed**. Root cause is a reusable bug pattern worth recognizing during triage of any "error X but reported as success/pass" issue.

**The pattern:** a failure is detected and *logged*, but the value that actually gets *recorded* is computed from a separate field that the failure path never updates — so a default/init value leaks through as success.

Concretely in `runUnitTestModule()` (tools/slang-test/slang-test-main.cpp):
- `exeRes.init()` sets `resultCode = 0`; `ToolReturnCode::Success == 0`.
- On RPC failure the server returns no result, so `resultCode` stays 0 → `testResult = _asTestResult(0) = Pass` (:5637).
- The failure IS captured, but only in a *separate* flag: `isFailed = SLANG_FAILED(rpcRes) || testResult==Fail` (:5639). `isFailed` is consulted **only** for the retry-queue decision (:5664, gated `!isRetry`), never folded back into the recorded result.
- So on the retry pass (or under `-disable-retries`, or for expected-failure-listed tests) control falls to `else reporter->addResult(testResult)` (:5675) and records the stale `Pass`.

**Triage lens / discriminators:**
1. When two variables track "did it fail" (here `isFailed` vs `testResult`/`resultCode`) and only one drives the *recorded* outcome, suspect a propagation gap on the secondary/error path.
2. The bug surfaced on the RETRY path but was NOT retry-specific — the same `else` mis-records under `-disable-retries` and for expected-failure tests. Always check whether the gap is in the path you observed or in the shared result-classification it bypasses; frame the fix over ALL stale-pass paths, not just the one in the repro.
3. Fix at the representation: set the recorded result honestly on the failure path (mirror an adjacent honest path — here the VVL debug-layer block at :5648 already did `testResult = Fail`). Smallest principled fix beats guarding the one observed path.

This class is dangerous because it produces silent false negatives in CI (crashes turn green). No `.slang` regression test is feasible (a server crash isn't expressible and would destabilize the shared CI test-server) — such fixes are validated by review + CI/manual, with the no-test decision flagged for a maintainer.

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782392187766-ci-integrity-bug-class-a-detected-failure-is-logge.md`_
