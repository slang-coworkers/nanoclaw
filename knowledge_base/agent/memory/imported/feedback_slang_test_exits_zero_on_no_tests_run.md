---
name: feedback_slang_test_exits_zero_on_no_tests_run
description: "slang-test prints `no tests run` and exits 0 for a nonexistent test name — a typo'd path is indistinguishable from a pass by exit code. Gate on the `100% of tests passed (N/N)` line, and check N against intent"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: c06a26a7-d16f-4413-9138-47628ce414ab
---

# `slang-test` exits **0** when it runs nothing — never gate on its exit code

**Measured by slang-fixer 2026-08-06** (slang#12330), empirically before relying on it:

| invocation | stdout | exit |
|---|---|---|
| nonexistent test name | `no tests run` | **0** |
| real test | `passed test: '<name>'` + `100% of tests passed (N/N)` | 0 |

⇒ **a typo'd test path, a renamed file, or a test that was never copied into `tests/` is
indistinguishable from a green run by exit code alone.** The failure mode is silent and reads as
success.

## How to apply

- **Gate on the summary line, not `$?`:** require `100% of tests passed (N/N)` **and** check `N`
  against the number of tests you intended to run. `N` is the discriminator; the exit code carries no
  information about coverage.
- A single-test invocation should assert `N == 1`. A suite run should assert `N` matches the
  file/directive count you expect — and note that a slang-test denominator is a function of
  {suite, commit, API detection, flags}, so an *absolute* N is only meaningful against a same-machine
  baseline ([[feedback_a_pass_ratio_is_a_function_of_four_things_not_one]]). For a new test the robust
  form is the **delta**: suite went 32/32 → 34/34, so +2 = exactly the tests added.
- The `no tests run` string itself is a usable negative signal — grep for it explicitly and fail on it.

## Why this one matters more than the average harness quirk

This is the **absence-vs-failure** family, and the fixer found it the right way: by probing with a
deliberately bad input to see what the instrument does when it has nothing to say. A check whose
FAILURE is indistinguishable from its NEGATIVE RESULT is not a check
([[technique_keeping_this_store_reachable]]).

It also composes badly with a new test file. A brand-new `.slang` test is *exactly* the case where the
file might not be where the harness looks — untracked, wrong directory, omitted from a `git diff`-built
patch (which the same chain hit: *"a patch built from `git diff` silently omits untracked test files"*).
So the run that most needs a coverage check is the one whose exit code is least informative. ⇒
⭐⭐**for a newly-added test, "it passed" is only credible with N stated.**

## Second instance, one level up: a WRAPPER's exit code (same chain, 20 min later)

Fixer launched both baseline suites with `nohup … &` and the harness notified **"completed (exit code
0)"** for both **within seconds**. That was the **launcher** exiting, not the suites:
`pgrep -c -f slang-test` = **12** still running, and both logs were still at the
`Supported backends:` preamble with no summary line.

⇒ ⭐⭐⭐**A zero exit from a wrapper says nothing about the work it wrapped** — and the resulting
artifact (a log with zero results) is **shape-indistinguishable from a real pass** if you grep it for
failures rather than for the summary. Reporting a "passing matrix" from those two logs was one step away.

Its fix is the right shape and generalizes: monitor keyed to the `N% of tests passed (N/N)` line itself,
**plus an explicit `ENDED WITHOUT SUMMARY` arm so a crash cannot read as silence.** That second arm is
the part usually omitted — see the Monitor coverage rule (a filter matching only the success marker stays
silent through a crashloop).

## Related

[[feedback_a_pass_ratio_is_a_function_of_four_things_not_one]] (what N is a function of — don't publish
a bare ratio) · [[feedback_a_zero_on_a_crashed_run_is_vacuous]] (a zero needs a COVERAGE control, not
just a liveness one) · [[feedback_signature_grep_passed_vs_failed]] (a name-grep can match a
`passed test:` line) · [[feedback_zero_test_jobs_is_not_zero_tests_ran]] (the CI-level twin: "0 jobs
named test" ≠ "0 tests ran") · [[project_12330_entrypoint_throws_not_diagnosed]]
