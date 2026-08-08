---
name: feedback_a_slang_test_pass_tally_hides_first_pass_flakes
description: "slang-test's N-1/N tally EXCLUDES first-pass failures: PendingRetry returns before m_totalTestCount++, so a test that flakes then passes on retry leaves zero trace in the totals. Count 'failed(pending retry)' lines for flake rate, never the pass line."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 35faaf43-6f61-44e5-aa36-55769e43b018
---

⛔ **A slang-test `N-1/N passed` tally is NOT a flake count — it systematically undercounts.** A unit
test that fails on first pass and passes on the in-job retry is invisible in **both** numerator and
denominator.

**Verified at source, at the 07-19 sha `eccfc77a073250bc01b4b73898759b860710d237`** (raised by
slang-ci-babysitter; I re-derived rather than relaying — the rule about not passing a peer's diagnosis
along as fact):

`tools/slang-test/slang-test-main.cpp:5700-5714` — on a first-pass unit-test failure:
```cpp
if (isFailed && !context->isRetry && !context->options.disableRetries &&
    !context->getTestReporter()->m_expectedFailureList.contains(test.testName))
{
    context->failedUnitTests.add(test.command);
    // Mark test as pending retry - it won't be counted in statistics yet
    reporter->addResult(TestResult::PendingRetry);
}
else { reporter->addResult(testResult); }
```

`tools/slang-test/test-reporter.cpp:369` — the load-bearing half, and the part worth checking rather
than assuming from the enum name:
```cpp
if (info.testResult == TestResult::PendingRetry)
{
    printf("failed(pending retry) '%S'\n", ...);
    return;                    // <-- BEFORE m_totalTestCount++
}
info.testResult = adjustResult(...);
m_totalTestCount++;            // numerator/denominator start here
```
⇒ `PendingRetry` reaches **neither** `m_totalTestCount` nor `m_failedTestCount`. Only the retry's
outcome is counted.

⭐⭐⭐ **The mechanism predicts the observed coordinates** (the standard this store demands — see
[[feedback_mechanism_must_predict_observed_coordinates]]). Today's live log, one job:
```
failed(pending retry) 'gfx-unit-test-tool/computeSmokeVulkan.internal'        ← retried, PASSED, invisible
failed(pending retry) 'gfx-unit-test-tool/sharedBufferD3D12ToCUDA.internal'   ← retried, FAILED again, counted
99% of tests passed (11526/11527), 1624 tests ignored
```
Two first-pass failures, tally shows **one**: `11526/11527`, not `11525/11527`. `computeSmokeVulkan`
flaked and left **zero** trace in the totals.

✅ **USEFUL COROLLARY (the direction that helps):** a leg ending `failure` with a counted test failure
**cannot** be a test that passed on retry — the counted result IS the retry's result. So *"failed,
retried in-job, failed again"* follows from the mechanism for any counted failure, without needing the
log. That is what upgraded a memo-only clause to code-derivable on slang-rhi#816.

⚠️ **BOUNDARY — the derivation proves the SHAPE, not the IDENTITY.** It shows *whichever* test was
counted failed twice; it cannot show **which** test or **which** error code that was. For a leg whose
log has expired, "which test / which error" stays note-only. Do not let the code trace carry more than
it can — the wrong-scope failure this store keeps re-learning (ANCHOR C carve-out).

⇒ **For flake frequency, count `failed(pending retry)` lines; never derive it from the pass line.**
Guards checked before relying on the retry path: the loop covers `gfx-unit-test-tool`
(`slang-test-main.cpp:6092`), and `disableRetries` has **0** hits in that sha's `ci.yml`, so nothing
disarmed it. Retry-layer vocabulary (three layers, not one):
[[feedback_two_retry_layers_make_retried_still_failed_ambiguous]].
