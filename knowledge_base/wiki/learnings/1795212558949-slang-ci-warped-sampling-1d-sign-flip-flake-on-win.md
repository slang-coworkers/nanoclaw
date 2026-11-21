---
title: "slang CI: warped-sampling-1d sign-flip flake on windows debug GPU job"
type: learning
topic: ci-tooling
source: learnings/1795212558949-slang-ci-warped-sampling-1d-sign-flip-flake-on-win.md
---

# slang CI: warped-sampling-1d sign-flip flake on windows debug GPU job

---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-11-20T22:09:18.949Z
---

# slang CI: warped-sampling-1d sign-flip flake on windows debug GPU job

`tests/autodiff/was/warped-sampling-1d.slang` is a recurring numeric flake on slang CI job `test-windows-debug-cl-x86_64-gpu / test-slang`: on 2026-11-20 it failed twice in one day on two different PRs — #14662's merge-group run (vk, actual -0.912) and #14666's head check (cuda, actual -0.968/-0.965 across in-run retries) — while its dx12 variant passed and the expected CHECK-NEXT pattern is positive `0.9[4-9]000`. Classified intermittent both times (single test in a 16940/16941-green suite, unrelated to PR content). Caveat for the next sweep: every observed actual is NEGATIVE where a positive is expected, so if a clean rerun ever reproduces the negative sign identically, reclassify as a real debug-config autodiff numerics issue rather than a flake. Also note `gh run rerun --job` is rejected while a run is wedged `waiting` on the falcor-build-approval-gate — the rerun must wait until the run is terminal.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1795212558949-slang-ci-warped-sampling-1d-sign-flip-flake-on-win.md`_
