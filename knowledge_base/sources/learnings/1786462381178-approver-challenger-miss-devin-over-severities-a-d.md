---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786459873070-1caovv
written_at: 2026-08-11T15:33:01.178Z
---

# [approver/challenger-miss] Devin over-severities a diagnostic mislabel to 🔴; adjudicate against the consuming code, not the label

**PR**: shader-slang/slang#12471 @ c9898ad8925b (slang-test test-server death handling). Decision WOULD_APPROVE.

**Symptom**: Devin returned a **🔴 Bug** at `tools/slang-test/slang-test-main.cpp:1447` — "tests are wrongly listed as having killed a test server when the server merely failed to start" — while the production `github-actions[bot]` review rated the SAME code region only a **🔵 Question** at `:1438`. A naive parse (any 🔴 ⇒ BLOCK) would have blocked a mergeable PR on a bad-tier signal.

**Root cause of the disagreement**: the flagged line is `recordTestServerLoss()` on the `first ∈ {Lost,StartFailed}` → retry-succeeds path. Tracing the consumer: `recordTestServerLoss()` touches ONLY `m_testServerLossCount` / `m_testServerLossTests`; `didAllSucceed()` is `m_failedTestCount==0`, and neither field is that. The test returns `SLANG_OK` (passes, not charged). The count is consumed only by a warning `printf` block in `outputSummary` (`test-reporter.cpp:767+`). So the true impact is: a *spawn-failure*-then-recovered test gets listed under a warning headline that says the server "died" when it "failed to start" — a **diagnostic-label imprecision with zero verdict / exit-code / charging consequence.** Devin's own finding text scoped it to "wrongly LISTED"; it inflated that to severity Bug.

**How to catch it (transferable)**: When two review sources disagree on severity for the same location, the tie-breaker is the CONSUMING code, never the label. Trace what the flagged write actually feeds: if it reaches only a log/summary string and never the pass/fail counters, the exit code, or the result recorded for the test, it is at most a nit regardless of the emoji. `didAllSucceed()`/`m_failedTestCount`/the returned `Result` are the load-bearing sinks in slang-test — a finding that doesn't reach one of them cannot be a 🔴. Devin runs head-current and is the ONLY signal on some PRs, but it calibrates hot on diagnostic wording; corroborate any Devin 🔴 against the primary body's severity for the same region before letting it drive BLOCK.

**Fix**: parsed no 🔴 in the authoritative primary body; adjudicated Devin's 🔴 down to the production 🔵 by reading the sink. Verdict APPROVE_WITH_NITS → clean challenger → WOULD_APPROVE. See also the slang-test false-green cluster (#11911 mode-gated retry, `(0/0)` exit-0) — this PR fixes the FILE-test + abort-exit paths and defers the general `reconcilePendingRetries()` form to #12453.
