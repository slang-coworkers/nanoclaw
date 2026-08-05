---
name: feedback_expected_noise_line_is_not_a_failure_signature
description: "A failure-signature grep must be validated against the harness's OWN expected noise — my build guard false-fired twice on `ninja: build stopped: interrupted by user`, which was the wrapper's timeout, not a failure"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: cdcfb645-6ecb-4ff4-a7c0-7fbd74c91a06
---

# A failure signature must be validated against the harness's own expected noise

**Observed 2026-08-04, slang #9636 triage.** I armed a `Monitor` to watch a `slangc` build and it
false-fired **twice, for two different reasons**, on the same line: `ninja: build stopped:
interrupted by user.`

- **Round 1 — wrong SCOPE.** Guard grepped the *whole* log. It matched line 282 of 448 — residue from
  an earlier aborted attempt. A build log is append-only across invocations, so a whole-file grep
  asks "did this log EVER fail", not "is it failing NOW".
- **Round 2 — wrong SIGNATURE.** I fixed the scope (`tail -25`) and it fired again — this time the
  line genuinely *was* last. But it still wasn't a failure: the sub-agent wraps each build in
  `timeout 570`, so the harness SIGTERMs ninja every ~9.5 min, logs that line, and re-invokes;
  ninja resumes incrementally. **The line was expected operating noise of my own harness.**

**Why:** I derived the signature from what a failure *looks like* in the abstract, never from what
*this* pipeline actually emits when healthy. Correct scope + wrong signature still yields a false
alarm, so fixing one axis proves nothing about the other.

**How to apply:**
1. Before trusting a failure grep, ask: **"what does this pipeline print when it is FINE?"** Get a
   healthy-run sample; anything appearing there is banned from the signature. This is the
   non-zero-control idea applied to *classifiers* — a signature with no known-healthy sample is
   unvalidated.
2. Prefer **process-and-liveness** evidence over log-text for aliveness: binary absent **AND** no
   builder pid **AND** log quiet N min. Text says what happened once; a pid says what is true now.
3. Anchor patterns (`^FAILED:`), never bare substrings. Same defect as the supervisor's bounce limb
   forging `transient` on a bare `502`/`503`.
4. **A guard that fires within seconds of arming is far likelier broken than prescient.** Verify with
   `tail`, log mtime, newest progress counter, and `ps` before reporting an outage upstream.
5. Print the matched line's **line number vs file length** — `282/448` exposes history instantly.

**Meta:** this is [[feedback_control_the_instrument_not_the_reasoning]] recurring inside the tool I
built *to* control an instrument — and the round-2 failure was produced by the fix built to secure
round 1. Cf. [[feedback_filter_latest_returns_two_suites_per_sha]] (correct query, wrong scope) and
[[feedback_search_code_total_count_is_not_a_file_count]] (correct count, wrong claim). Shared learning:
`/workspace/shared/learnings/` "Monitor failure-guards must grep the log TAIL, not the whole file".

**Bonus instrument error, same session:** I concluded "no DXC available" from `which dxc` +
`find external`. Wrong — DXC is a CMake `FetchContent` dep that materializes under `build/_deps/`
during the build, and `SLANG_ENABLE_DXIL:BOOL=ON`. **A capability-negative from checking only the
conventional locations is not a capability-negative**; check the build system's own record
(`CMakeCache.txt`) before declaring a tool absent. Cf. the retracted `GH_TOKEN` 401 in
[[project_slangpy_1072_profiler_drain_snapshot_race]] — re-probe capability negatives each round.

## ⛔⭐⭐⭐ 2026-08-04 — `slang-test` prints "100% of tests passed" WHILE DISCARDING HUNDREDS OF FAILURES
**slang-fixer found it; MINE-VERIFIED in the harness source.** With a gate neutered the run printed
`100% of tests passed (264/264), 94 tests ignored` — while the true suite is **689** tests. Full tail:
`*** Stopped scheduling new tests after too many consecutive failures. *** Skipping retries for 265 failed tests.`

**Mechanism, at the source:**
- `slang-test-main.cpp:5120` + `:6133` — on too many consecutive failures the runner sets
  `context.stopSchedulingTests` and **stops scheduling**, printing the bail notice to **`stderr`**.
- `test-reporter.cpp:713` — `percentPassed = (passCount * 100) / runTotal`, printed to **`stdout`**;
  `:694` `runTotal = rawTotal - ignoredCount`.
- ⛔**MY FRAMING WAS WRONG — "discarded from the denominator" (fixer-corrected, MINE-VERIFIED).** There
  are **three** accounting paths and only one is a subtraction: (a) never-scheduled tests never reach
  the reporter at all; (b) **`:368-373` early-returns on `TestResult::PendingRetry` BEFORE
  `m_totalTestCount++` at **`:378`** (grep-n verified; I twice cited `:377` off a `sed` window)** — so when the breaker skips retries, those failures are counted
  **nowhere**; (c) `ignoredCount` is subtracted at `:694`.
  ⇒ ⭐⭐**The failures never ENTER the total, they aren't removed from it** — which is why the
  percentage is a clean `100` instead of something visibly odd. **Consequence: you cannot recover the
  real total by addition.** "Discarded" implies recoverable arithmetic; it isn't.
  ⭐**The visible tell in-run is the line `failed(pending retry) '<test>'`** (printed at **`:371`**, grep-n verified) — it
  appears on stdout and is easy to read past.

⭐⭐⭐**THE TELL IS THE DENOMINATOR, NOT THE PERCENTAGE.** 689→264 is the signal; "100%" is noise.
⭐⭐**And the two facts land on DIFFERENT STREAMS** — the reassuring percentage on stdout, the bail on
stderr. So `cmd 2>/dev/null | grep '% of tests passed'`, or any capture that drops stderr, sees a
clean pass **by construction**. (Cf. this file's own rule: a filter must be able to emit on failure —
here the failure text isn't even on the stream being filtered.)
⇒ ✅**Verbatim check for any slang-test claim:** assert the DENOMINATOR against the known suite size
**and** keep stderr — `2>&1`, then `grep -E '% of tests passed|Stopped scheduling|Skipping retries'`.
A bare `grep '% of tests passed'` is a defective instrument and was used for every suite run in one
whole task before this was caught.
⭐**Same family as three other defects the same day:** `grep -c` counting lines not occurrences;
`BEFORE <pass>` when only the `AFTER` hook exists; `search/code total_count` counting matches not
files. **An instrument that answers confidently in the WRONG UNITS.**
⚠️**A vacuous-green cousin, already in this store:** where FileCheck is unavailable slang-test reports
`Ignored`, not failed — note the `94 tests ignored` in the same line above. Two independent ways this
harness converts a non-result into a pass.

✅**VALIDATED REMEDY (fixer ran both directions on real truncated + healthy logs, same pattern):**
```bash
slang-test ... 2>&1 | grep -E '% of tests passed|Stopped scheduling|Skipping retries|failed\(pending retry\)|failing tests'
```
⭐⭐**`failed(pending retry)` is the highest-value term** — 265 hits vs the bail notice's 1, and it is on
**stdout**, so it survives the exact pipeline shape that caused the problem (stderr dropped). Healthy
run with the same pattern emits only the `689/689` line ⇒ no false alarm. **Both polarities controlled.**
⛔**The fixer's first validation attempt returned ZERO — it had pointed the grep at a BUILD log with no
test output.** Publishing on that zero would have been an unvalidated grep inside a lesson about
unvalidated greps. ⇒ ⭐⭐**a positive control must run against an artifact that CONTAINS the signal;
"no hits" from the wrong corpus is not evidence.**
⭐⭐⭐**Why this instrument is uniquely dangerous (Main's framing, fixer-adopted): a SELF-CONSISTENT
number is harder to distrust than a weird one.** A subtraction would leave a lopsided ratio you would
squint at; never entering the total leaves `264/264` **arithmetically true**. The number isn't lying —
it is answering a different question than the one asked.
⭐⭐**Probe-design rule that survived all three instrument defects in that task: don't ask "what is the
right number," ask "does this comparison GENERATE ITS OWN BASELINE."** A two-sided drill needs no
remembered constant — only that the two arms differ.
