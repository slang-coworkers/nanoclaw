---
title: "slang#11600 falcor YML 3-file refactor — triage design notes"
type: learning
topic: slang-compiler
source: learnings/1781365729972-slang-11600-falcor-yml-3-file-refactor-triage-desi.md
---

# slang#11600 falcor YML 3-file refactor — triage design notes

Triage of shader-slang/slang#11600 ("Refactor falcor YML", author jkwak-work COLLABORATOR, label "Dev Opened", CI-config enhancement). This is the **explicit follow-up to #11495** (the falcor-test.yml build/test split, which flagged falcor-compiler-perf-test.yml as the out-of-scope sibling). Goal: 3-file scheme mirroring ci.yml — `falcor.yml` dispatcher + reusable `falcor-slang-build.yml` (workflow_call) + reusable `falcor-slang-test.yml` (workflow_call) — so ONE slang build artifact is shared by all falcor tests; plus a `check-falcor` aggregator made required for master.

Net-new shape not covered by prior learnings. Key findings:

- **The crux is build-flag reconciliation.** Today the two falcor workflows each do their OWN build with DIFFERENT cmake flags producing DIFFERENT artifacts. functional (falcor-test.yml:49-58): USE_SYSTEM_LLVM, WARNING_AS_ERROR, CUDA=1, EXAMPLES=0, GFX=0, TESTS=0, EXCLUDE_DAWN=1, EXCLUDE_TINT=1, RHI=0 → `slang-falcor-build-windows-release`, test on [falcor]. perf (perf-test.yml:51-54): USE_SYSTEM_LLVM, WARNING_AS_ERROR, CUDA=1 ONLY → `slang-falcor-perf-build-windows-release`, test on [perf]. To share ONE artifact you must pick one flag set. Recommend the FUNCTIONAL/restrictive set (faster; perf test only needs the core slang runtime DLLs + slangc on PATH, which the restrictive build still produces) WITH a hard CI gate that the perf test passes against it; fallback = the looser perf superset flags. Building twice = rejected (defeats the goal).

- **`materialx-test.yml` is the cleanest reusable single-integration-test template** (called from ci.yml:290): one job, `on: workflow_call` with 5 required string inputs (os/compiler/platform/config/runs-on), inline `download-artifact` then run one integration test — maps 1:1 to the falcor test shape. Far simpler than the multi-job/multi-API ci-slang-test.yml. Build skeleton template = `ci-slang-build.yml` (`runs-on: ${{ fromJSON(inputs.runs-on) }}`). Aggregator template = ci.yml:298-362 check-ci (`needs:[all tests]`, `if: always()`, exit 1 on failure/cancel).

- **Required-check mechanics (load-bearing):** the aggregator JOB KEY must be exactly `check-falcor` (kebab-case) — that string is the required-status-check name branch protection matches. AND the dispatcher must add a `merge_group: types:[checks_requested]` trigger (ci.yml:5-6) — a required check must run in the merge queue, not just on PR. Falcor currently triggers on pull_request only, so making it required without the merge_group trigger would deadlock the merge queue.

- **Two-divergent-shapes tension:** falcor-slang-test.yml must cover functional (unit+image on [falcor]) AND perf (robinraju release-download of falcor_perftest.exe + run on [perf]) — parameterize by a `test-type` input with conditional step blocks to honor the literal 3-file scheme.

- **Constraints:** bot can't push `.github/workflows/*` (deliver as a maintainer-applied patch comment); no local validation (no self-hosted falcor/perf runners, no GPU — actionlint/yamllint + reasoning only); branch protection is an admin repo-Settings change outside the diff; making falcor required elevates it advisory→blocking (flaky infra would block master); download-artifact v4+ is attempt-scoped so `gh run rerun --failed` on a test-only rerun breaks. NO GitHub triage comment posted — COLLABORATOR's own roadmap item with no @nv-slang-bot mention (per the issue_opened-without-mention drop rule).

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1781365729972-slang-11600-falcor-yml-3-file-refactor-triage-desi.md`_
