---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786459873070-1caovv
written_at: 2026-08-11T16:05:23.274Z
---

# [approver/clause-gap] Expected failures increment the consecutive-failure abort counter in slang-test — a new `!aborted` exit term can red a run with zero real failures

**PR**: shader-slang/slang#12471 @ c9898ad8925b. Decision ABSTAIN_POLICY:OPEN_GAP.

**Symptom**: A slang-test PR added `return (didAllSucceed() && !aborted) ? SLANG_OK : SLANG_FAIL;` (`slang-test-main.cpp:6470`) to stop exiting 0 when the run aborts on the consecutive-failure threshold. I initially cleared the `!aborted` term as "load-bearing only on an untested unit-test path, direction safe." codex DECISION_REVIEW flagged it as a false-red regression.

**Root cause / the mechanic (verified in source, pr12471)**: `runTest()` returns **raw `TestResult::Fail`** for an expected-failure test — the reclassification to `ExpectedFail` happens *later*, inside `TestReporter::addResult`/`adjustResult` (`test-reporter.cpp:168`), NOT in `runTest`. The consecutive-failure tracking at the (PR-untouched) call site `slang-test-main.cpp:5534` reads the **local `testResult`** (still `Fail`) → `context->reportTestFailure()` → `++` on the global `static std::atomic<int> s_consecutiveFailures` (`test-context.cpp:20,376`), threshold `kConsecutiveFailureAbortThreshold = 32`. So **expected failures DO count toward the abort threshold.** Pre-PR, an abort still returned `didAllSucceed()` (true when `m_failedTestCount==0`, and expected-fails don't bump that) ⇒ exit 0. The new `!aborted` term is the ONLY new route to `SLANG_FAIL` when `m_failedTestCount==0` ⇒ 32 consecutive *expected* failures with no interleaved pass now RED a run that has zero unexpected failures.

**Reachability**: low — the global counter is reset by any `Pass` (`reportTestPass`), and passes dominate a ~5900-test corpus — but NOT provably zero, and whether an abort-on-expected-failures *should* red is a genuine design question. Uncertainty ⇒ ABSTAIN, never rounds up.

**How to catch it (transferable — this is the general lens)**: When a PR adds a term to an EXIT-CODE or PASS/FAIL predicate, don't reason only about the *new* code — trace what FEEDS the variables the new term reads. Here the new term reads `aborted = stopSchedulingTests`, whose setter (`reportTestFailure`) is pre-existing and driven by a LOCAL result that is the *raw, pre-reclassification* value. A "the tested path covers it" clearance is wrong when the term is load-bearing on a *different, untested* path. The specific slang-test trap: **`runTest()` returns raw `Fail` for expected failures; reclassification to `ExpectedFail` is downstream in the reporter.** Any logic keyed on the local `testResult` before `addResult()` treats expected failures as failures. Grep `s_consecutiveFailures` / `reportTestFailure` reads whenever an exit-code change touches abort logic.

**Fix / meta-lesson**: the critique gate earned its keep here — DECISION_REVIEW caught a gap I'd cleared with a hand-wave. The correct response was to *verify the mechanic in source myself* (not defer to codex, not accept my prior clear) and let uncertainty drive ABSTAIN. Two-tiers-catch-what-one-cannot, concretely.
