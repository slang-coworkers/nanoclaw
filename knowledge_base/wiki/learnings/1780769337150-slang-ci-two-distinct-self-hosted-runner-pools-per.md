---
title: "slang CI: two distinct self-hosted runner pools (perf vs benchmark); #11501↔#11485 perf-CI overlap cross-linked"
type: learning
topic: ci-tooling
source: learnings/1780769337150-slang-ci-two-distinct-self-hosted-runner-pools-per.md
---

# slang CI: two distinct self-hosted runner pools (perf vs benchmark); #11501↔#11485 perf-CI overlap cross-linked

## Reusable codebase fact: `[self-hosted, perf]` and `[self-hosted, benchmark]` are DIFFERENT runner pools

shader-slang/slang has **two** self-hosted runner label sets — easy to conflate (I conflated them in a public comment and codex caught it):

- `[Windows, self-hosted, perf]` → used by `.github/workflows/falcor-compiler-perf-test.yml` and `compile-regression-test.yml` (falcor-shader compile-regression / perf, pulls `shader-slang/falcor-compile-perf-test`).
- `[Windows, self-hosted, benchmark]` → used by `.github/workflows/benchmark.yml` and `push-benchmark-results.yml` (MDL runtime/compile benchmark, pushes results to `shader-slang/slang-material-modules-benchmark`).

**How to apply:** when citing which runner a perf/benchmark workflow uses (especially in a public comment), grep the actual `runs-on:` line — do not assume "perf". `-report-perf-benchmark` (the slangc CLI perf flag) is at `source/slang/slang-options.cpp:603`.

## Coordination pattern: issue overlapping an in-flight contributor PR → cross-link comments, not a competing PR

Issue #11501 ("[CI] Add compile time performance checking CI workflow", @jkwak-work, 2026-06-06) heavily overlaps in-flight **PR #11485** ("Add compile-time performance test suite", @jvepsalainen-nv, draft, opened one day earlier). Same end-goal (compile-time perf-CI, per-PR + nightly), different workload source: #11501 wants `.slang-repro` capture/replay; #11485 ships synthetic stage-stress + MDL/DXR corpus driven by `slangc -report-perf-benchmark`, with a two-tier CI design (`tools/benchmark/perf-suite/CI_PLAN.md`, design-only/unwired).

**Verdict: NOT fixer-shaped.** Four durable blockers: (1) competing-PR rule (another contributor owns the work), (2) the natural fix (extend #11485's `manifest.py` with a `.slang-repro` workload kind) edits another contributor's branch, (3) bot lacks the GitHub-App `workflows` permission so cannot push `.github/workflows/*.yml`, (4) `.slang-repro` artifacts must be staged on a self-hosted secure machine the bot can't reach.

**Bot-shaped action = two operator-authorized cross-link coordination comments** (ask-don't-assert, mutual cross-link, bot disclaimer), one per thread, surfacing the overlap so the two human contributors decide scope. Posted: issue comment 4639899969 (#11501) and PR comment 4639900100 (#11485). Chain left **OPEN** (proposal undecided), awaiting a human reply that round-trips via webhook.

**Process note:** the coordination comments were operator-gated (held until the operator authorized posting) — that gate is a constraint on the *next action*, NOT one of the four "not-fixer-shaped" blockers. Keep the two categories separate when reasoning about whether to implement.

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1780769337150-slang-ci-two-distinct-self-hosted-runner-pools-per.md`_
