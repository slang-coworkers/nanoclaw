---
name: project_slang_test_filecheck_ignored_and_check_not_vacuity
description: "slang-test harness gaps found 2026-08-07 (#12423 chain), UNFILED: (1) no FileCheck => every filecheck= test returns Ignored (documented policy, names ARM64 CI) — silently SKIPPED, not counted as PASS; (2) nothing gates on exeRes.resultCode in filecheck= mode, so a CHECK-NOT-only test passes trivially when the compile stops emitting. Public filing needs operator authorization."
metadata:
  type: project
---

# slang-test: `Ignored` without FileCheck, and vacuous `CHECK-NOT`

Split out of [[feedback_a_watcher_scoped_to_the_known_hazard_reports_silence_as_all_clear]] 2026-10-02.
Peer's finds during slang PR #12423 review (2026-08-07), verified verbatim by me at the time.
**Status: unfiled** — a 2026-10-02 search of shader-slang/slang for the quoted strings found no issue.
Filing is a public write ⇒ needs operator authorization; keep it separate from #12423.

## Finding 1 — no FileCheck ⇒ `Ignored`, as documented policy

`tools/slang-test/slang-test-main.cpp:816-822`:
```cpp
if (!fc) {
    // Ignore if FileCheck is not available.
    // We could report an error, but our ARM64 CI doesn't have FileCheck yet.
    testReporter.message(TestMessageType::Info, "FileCheck is not available");
    return TestResult::Ignored;          // not Fail
}
```
✅ **Aggregation measured before characterizing it — "silently SKIPPED, not silently PASSED":** at default
verbosity `Ignored` is suppressed alongside `Pass` (`test-reporter.cpp:407-411`), `m_hideIgnored`
defaults false (`test-reporter.h:148`), and `Ignored` has its own `TestResult` and reporter cases — it is
not tallied as a pass. ⭐⭐ The stronger "counted green" version would die to a 30-second
`grep 'case TestResult::Ignored'`. **Claim the version the code supports, not the one that lands hardest.**

## Finding 2 — nothing checks the result code in `filecheck=` mode

`slang-test-main.cpp:963-968` is a ternary: `defaultExpectedContent` (which embeds `result code = N` via
`getOutput`) reaches only `_fileComparisonTest`. So in `filecheck=` mode **a bare `CHECK-NOT` passes
trivially when the compile stops emitting** ⇒ every `CHECK-NOT`-only test is potentially vacuous.
`:2319 if (exeRes.resultCode != 0) actualOutput = getOutput(exeRes);` is an **output selector, not a
gate** — the `Fail` at `:2324` is inside the else (compile succeeded, run failed).

⛔ My own "consequence 1" (the code is checked by comparison) was wrong — peer-caught: true for
`.expected`-file tests, inapplicable to exactly the tests at issue. ⭐⭐ **Reading the FORMATTER told me
what data exists; only the DISPATCHER tells you whether anything CHECKS it.** Data present ≠ data asserted.

✅ Mitigation already in the #12423 tests: `PRESENT`/`PROMOTED` positives beside each `CHECK-NOT`. **A
positive directive is what makes a negative one meaningful**, independent of harness behaviour. Related:
[[feedback_slang_test_exits_zero_on_no_tests_run]].

## Lessons from the exchange

- ⭐⭐⭐ **State N in the claim even when it is large** — a claim carrying its own N invites a check of the
  denominator. Three consecutive statements of mine needed narrowing (suite-wide → one runner → not even
  that mechanism); the peer's original error quantified over the harness from N=1 runner. Cf.
  [[feedback_publish_a_claim_as_wide_as_your_evidence]].
- A peer's 09:44 retraction reverted its own better 08:42 reading of `:2319`; re-verifying beat
  deferring — see the stale-retraction section of [[feedback_deference_drifts_to_whoever_corrected_you_last]].
