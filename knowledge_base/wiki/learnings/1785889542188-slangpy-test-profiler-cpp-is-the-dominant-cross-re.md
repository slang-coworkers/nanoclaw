---
title: "slangpy test_profiler.cpp is the dominant cross-repo evictor of slang PRs — and the mitigation PR skipped the wrong two cases"
type: learning
topic: slang-compiler
source: learnings/1785889542188-slangpy-test-profiler-cpp-is-the-dominant-cross-re.md
---

# slangpy test_profiler.cpp is the dominant cross-repo evictor of slang PRs — and the mitigation PR skipped the wrong two cases

## What

The cross-repo **`SlangPy Tests`** commit status (note: a *commit status*, not a check-run — it lives on a
separate API surface and is invisible to `/check-runs`) can evict a `shader-slang/slang` PR from the merge
queue. As of 2026-08-05 the dominant cause is **`tests/sgl/device/test_profiler.cpp` in slangpy**, not
anything in the slang PR under test.

Measured: `repos/shader-slang/slangpy/actions/runs?event=repository_dispatch&per_page=100` → 100 runs
spanning 08-01..08-05, **6 failed**, of which **4 were profiler-only** — always the *sole* failing case out
of 200 (e.g. 199/200 cases, 3/17202 assertions). Two distinct assertion sites:

- Linux: `frame statistics align repeated and intermittent zones` (line 228), CPU-timing —
  `CHECK(second_snapshot->entries()[1].cpu_time_per_call.count == 2)` got `1`
- Windows: `GPU query exhaustion preserves CPU zones` (line 511), line 534 `query_zones("exhausted gpu", ...)`

## The actionable gap

Upstream already root-caused it: **slangpy#1072** (profiler collector finalizes a global frame before
consuming attached cross-thread zones), fix PR **#1073** open, follow-up **#1077** open. The interim
mitigation **#1076 "Temporarily disable intermittent profiler tests" merged 2026-07-28** — but reading the
patch, it `doctest::skip()`ed only line 332 (`global frames include zones from other threads...`) and line
598 (`device close settles pending frame statistics`).

**The two cases actually flaking are different ones, and both are still ENABLED at HEAD** (verified against
`test_profiler.cpp` at HEAD: 628 lines, only those two carry `doctest::skip`). That is why slang PRs kept
getting evicted on 08-03 and 08-04, five days after the "disable the flaky tests" PR merged.

Generalizable lesson: **a merged "disable the flaky test" PR is not evidence the flake stopped.** Diff which
cases it actually skipped against which cases are actually failing — the two sets can be disjoint, and the
closed mitigation issue makes everyone stop looking.

## How to apply

When a slang PR reds or evicts on `SlangPy Tests`, check whether the sole failing case is one of those two
before treating it as the slang author's fault — it is external and they can do nothing about it. Do **not**
conflate with slangpy#1062 (`sgl_tests` teardown), whose signature is `Status: SUCCESS!` with everything
passing and *then* exit 1; here doctest genuinely reports `Status: FAILURE!` with a real assertion.

The bot cannot rerun slangpy at all — the gateway App token is scoped to `slang/*`, so slangpy
`repository_dispatch` runs are unrerunnable. Classify and report only.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785889542188-slangpy-test-profiler-cpp-is-the-dominant-cross-re.md`_
