---
name: feedback_one_dead_test_file_is_not_a_dead_subsystem
description: "slang#10480: 8 replayRecord_* tests are unconditionally SLANG_IGNORE_TEST'd (true), but calling replay coverage 'zero' was a DENOMINATOR error — 11 test-bearing files hold 125 replay tests, ~117 live. Count the set (membership filter: file glob or header include, never a prose substring), classify each ignore, and state the set beside the number."
metadata:
  node_type: memory
  type: feedback
  tags:
    - ci
    - verification
    - coverage
    - denominator
---

# One dead test file is evidence about that file, not the subsystem

**Rule:** a claim that a subsystem is uncovered is a claim about the **whole set** of its tests.
Measure the set before you frame it. A verified numerator ("these 8 are dead") does not license a
denominator claim ("coverage is zero").

## The case (slang#10480, 2026-08-04)

- ✅ **Exact and endorsed:** an unconditional `SLANG_IGNORE_TEST` at the top of `runTest()`
  (`tools/slang-unit-test/unit-test-replay-record.cpp:170`, there since #9925 introduced the file).
  It fires before every guard, so all **8** `replayRecord_*` cases report `Ignored` and never record
  or replay.
- ⛔ **Wrong framing:** "a vacuous green — zero replay coverage". `slang-triager` corrected it. There
  are **11 test-bearing files**: 10 matching `unit-test-replay-*.cpp` (120 tests), plus
  `unit-test-record-replay-api.cpp` (5), which that glob doesn't match. They hold **125** tests, of which
  only those 8 are dead. `stream-decoder`'s 6 ignores sit in `#else` arms (compile-config, not dead).
  `REPLAY_TEST` (`unit-test-replay-common.h:36`) has no ignore, and the live tests do real in-process
  record→playback round trips (e.g. `unit-test-replay-integration.cpp:582-616` asserts
  `getStream().atEnd()`). **About 117 tests are live.**
- **What genuinely was zero, and needed no exaggeration:** (a) the out-of-process record →
  `slang-replay` round trip the issue asks for, and (b) any replay coverage on `pull_request` (the
  coverage job is `workflow_call`-only from a nightly cron).

## State the set, not just the count

The verdict as first published said "125 tests across 12 `unit-test-replay-*.cpp` files". No reading of
that is true. The glob matches 10 files with 120 tests, reaching 125 needs the file the glob excludes,
and 12 is only reached by counting the test-free header. Each figure checked out on its own; only
the join was false. A wider net (`grep -rl SLANG_UNIT_TEST | xargs grep -l -i replay`) returns 134 by
pulling in `unit-test-repro-validator.cpp`, which belongs to the `-load-repro` system and matched on a
prose comment. **Filter on membership (a subsystem header include or a test-name prefix), never on a
substring in prose or identifiers.** Too wide a scope produces a false refutation
([[feedback_search_code_total_count_is_not_a_file_count]]).

✅ Resolved: comment `5176004164` was PATCHed in place to "125 replay unit tests across 11
test-bearing files (the 10 matched by `unit-test-replay-*.cpp`, holding 120, plus
`unit-test-record-replay-api.cpp`, holding 5)". An in-place PATCH notifies nobody and stacks nothing,
so the "costs a maintainer's attention" objection to fixing it never applied
([[feedback_github_comment_hygiene]]).

## The check

```bash
for f in tools/slang-unit-test/unit-test-<subsystem>*.cpp; do
  echo "$(basename $f): tests=$(grep -c 'SLANG_UNIT_TEST' $f) ignores=$(grep -c 'SLANG_IGNORE_TEST' $f)"
done
```

Then classify each ignore as unconditional (dead), `#if`/`#else` arm (compile-config), or
runtime-guarded.

## Severity needs a reachable trigger

The two secondary defects (stale or misnamed `expected-failure` entries) are structurally real but
**inert**. They only reclassify a `Fail` result (`test-reporter.cpp:168-169`, `:878-879`), and these
tests report `Ignored`, so the entries are cosmetic until `:170` is fixed. An arm being reachable is
not the same as it being reached ([[project_12333_dev_null_output_path_tests]]).

Related: [[feedback_a_zero_needs_its_denominator]],
[[feedback_an_empty_failure_set_needs_a_denominator]]. Parent family:
[[feedback_green_job_skipped_backend_zero_coverage]].
