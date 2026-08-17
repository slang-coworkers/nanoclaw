---
title: "Slang compile-time perf-CI (#11501) overlaps PR #11485 — converge via workload-kind; infra already in-tree"
type: learning
topic: slang-compiler
source: learnings/1780769174979-slang-compile-time-perf-ci-11501-overlaps-pr-11485.md
---

# Slang compile-time perf-CI (#11501) overlaps PR #11485 — converge via workload-kind; infra already in-tree

# Slang compile-time perf-CI: issue #11501 ↔ PR #11485

**Context:** Triaged shader-slang/slang#11501 ("[CI] Add compile time performance checking CI workflow", @jkwak-work, 2026-06-06). Feature-request / CI infra / P2 / medium. Motivating bug: real compile-time regressions (e.g. #11474, 16–36% MDL regression).

**Key finding — in-flight overlap (check this before re-researching):** PR **#11485** (@jvepsalainen-nv, NVIDIA, draft, opened 2026-06-05 — one day *before* the issue) is already building per-PR + nightly compile-time perf-CI for the SAME end goal, but via **synthetic stage-stress + MDL/DXR workloads driven by `slangc -report-perf-benchmark`**, framework under `tools/benchmark/perf-suite/` (`manifest.py`). #11501 instead asks for a **`.slang-repro` capture/replay corpus**. Same end-goal, different workload source. The issue author did not reference #11485.

**Recommended convergence (Approach A):** Fold `.slang-repro` into #11485's framework as an additive **workload kind**, NOT a parallel `replay-perf.yml`. Mechanics: driver invokes `slangc -load-repro <file> -report-perf-benchmark`; output schema is the identical `[{name, value, unit}]` JSON the synthetic path already consumes (no parser change); repros pre-staged on the existing `[Windows, self-hosted, benchmark]` runner under e.g. `C:\slang-repro-corpus\` (same on-runner-storage pattern `.github/workflows/compile-regression-test.yml` uses for `/c/slang_compile_test_suite_a`); reuses #11485's two-tier soft-fail + nightly-trend design and external results-store. The issue's "self-hosted secure machines" requirement is already satisfied — repros never leave the runner, only aggregate timings get pushed. **Defer** the `manifest.py` enabling patch until #11485's CI wiring lands (schema still in flux + competing-PR optics under the `feedback_competing_pr` rule).

**Infra inventory already in-tree (no new provisioning needed):**
- Capture/replay CLI: `-dump-repro`, `-load-repro`, `-load-repro-directory`, `-extract-repro`; env `SLANG_RECORD_LAYER=1` — `source/slang/slang-options.cpp` ~986-1015.
- Perf reporting: `-report-perf-benchmark`, `-report-downstream-time` — `slang-options.cpp` ~602-604; `ISlangProfiler` in `include/slang.h` ~1887-1899.
- Self-hosted runner labels provisioned: `[Windows, self-hosted, benchmark | perf | regression-test | build]`.
- Workflow templates: `.github/workflows/benchmark.yml`, `falcor-compiler-perf-test.yml`, `push-benchmark-results.yml`, `compile-regression-test.yml`.
- Results storage pattern: external git repo `shader-slang/slang-material-modules-benchmark` via `push-benchmark-results.yml` ~51-66.

**Constraint that blocks bot implementation:** the automation account (nv-slang-bot) cannot push `.github/workflows/*.yml` — missing GitHub App `workflows` permission (confirmed slang#11438). Workflow wiring needs a human contributor.

**Related (do not act on):** #11100 (precursor request), #11474 (motivating MDL regression), #10339 (replay super-issue), #10480 (replay CI for *correctness*, not perf), #9925 (replay system PR, merged 2026-02-08).

**Outcome:** Held awaiting maintainer A/B/C decision (fold / separate / sequence-after-merge) posted as a checklist on #11501. No code change; no PR.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1780769174979-slang-compile-time-perf-ci-11501-overlaps-pr-11485.md`_
