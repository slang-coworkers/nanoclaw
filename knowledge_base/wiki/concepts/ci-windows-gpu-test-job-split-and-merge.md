---
title: "Windows GPU slang-test jobs: the API split, the merge back, and sizing CI jobs from step timings"
type: concept
group: ci-tooling
tags: [ci, slang, windows, gpu, slang-test, via-glsl, timeout, job-split, job-merge, timing, unit-tests, ci-slang-test]
source_count: 5
---

# Windows GPU slang-test jobs: the API split, the merge back, and sizing CI jobs from step timings

How the shader-slang/slang Windows GPU `test-slang` job was split by graphics API and merged back, what each shape costs in wall-clock time against the `ci-slang-test.yml` timeout, which tests a split silently drops, and how to project and measure CI step times. The runner fleet these jobs run on is described in [CI Flake Triage — Runner Pools and Infrastructure](ci-flake-runner-pools-and-infrastructure.md); why a bot draft gets no CI to measure is in [Draft-PR CI, Priority-Yield, and Conditional Claims](ci-b-draft-pr-ci-and-conditional-claims.md).

## TL;DR

- The Windows GPU test was split by `-api` into `-gpu-dx` / `-gpu-vk` / `-gpu-cuda` jobs (#12422). PR #13813 (issue #13791, merged 2026-10-21) merged them back into one `test-windows-{debug,release}-cl-x86_64-gpu` job per config, with `-api all` and via-glsl on.
- A split by `-api` silently drops unit tests that need two APIs in one run (`sharedBufferD3D12ToCUDA`, `sharedBufferVulkanToCUDA`). Every split job reports them `ignored`, not failed. Check for such tests whenever you review a split or a merge. A failure on the first merged run was hidden by the split, not caused by the merge.
- Measured merged job on T4: Debug 90.8 min (Test Slang 55.8 + via-glsl 33.6), Release 21.5 min (Test Slang 14.5 + via-glsl 5.2).
- `ci-slang-test.yml` `test-slang` `timeout-minutes` is now 120 for EVERY caller (it was 80). Debug uses about 76% of it. A per-caller timeout input was a review nit that never shipped, so if the Debug job keeps growing the shared 120 will bite first.
- Project a merge or split before you push: merged main step ≈ 0.50–0.57 × the sum of the split main steps, plus the measured via-glsl step, plus setup. That method predicted 85–90 min Debug and 18–22 min Release, and it held.
- `Test Slang via glsl` and `Run Slang examples` run only on `pull_request` events. A `workflow_dispatch` run skips them, so its wall-clock understates PR time. Add the via-glsl time from a real PR run and call the result a projection.
- A bot draft PR has no `pull_request` CI, and its dispatch runs are deadlocked behind the Falcor approval gate. A bot PR whose branch lives only on a fork cannot be dispatched at all. Its first real timing comes when a maintainer marks it ready, and a push while that run is in flight cancels it.
- Read step times from `gh api repos/shader-slang/slang/actions/jobs/<id>`. Jobs older than about 60 days return an empty `steps` array, so only job-level start and finish remain.
- slang-unit-test-tool prints no per-test durations in CI. Use the timestamps on its `passed test:` lines from `gh run view --log` to get phase length and tail time.

## The API split, and the tests it hid

The split ran one Windows GPU job per API: `-gpu-dx`, `-gpu-vk` and `-gpu-cuda`, each passing its own `-api` to slang-test (#12422). That shape silently drops any unit test that needs two APIs in the same run. `gfx-unit-test-tool/sharedBufferD3D12ToCUDA` and `sharedBufferVulkanToCUDA` (tools/gfx-unit-test/shared-buffers-tests.cpp:93-101) reported `ignored` in all three split jobs of run 39538678191, because `createTestingDevice` ignores any device type that is not in `enabledApis` (gfx-test-util.cpp:219). Merging the jobs brings these tests back. So when a merged run first fails one of them, the split hid the failure; the merge did not cause it ([API-split jobs silently ignore cross-API unit tests](../learnings/1792579623451-windows-gpu-slang-test-api-split-jobs-silently-ign.md)).

The merge did not bring back the #13298 runner loss either. That 14m01s merge-queue death was pagefile commit exhaustion from eight `test-server.exe` processes on a 1 GiB-pagefile image (see [runner pools](ci-flake-runner-pools-and-infrastructure.md)). The merged 8-server `-api all` job ran on that same old image until 2026-08-07 (a 31 GiB commit limit) with no 14m01s failures, so putting all APIs in one job was not what exhausted memory ([API-split jobs silently ignore cross-API unit tests](../learnings/1792579623451-windows-gpu-slang-test-api-split-jobs-silently-ign.md)).

## Measured timings and the shared timeout

Before the split, the single Windows Debug job took 45–52 min (runs 31213069527 and 31205082754 on 2026-08-07 took 45–46 min), and it ran no via-glsl step. The split jobs took 28 / 35 / 28 min. Since #13799 added `Test Slang via glsl` there, that step takes 31–33 min on Debug T4 and about 4 min on Release (runs 39538678191, 39557486797). Each split Debug job's main `Test Slang` step took 35–41 min, so by October the split Debug `-gpu-vk` job alone took 70–75 min against the 80-min timeout ([merging the split jobs: Debug via-glsl ~32 min blows the 80-min timeout](../learnings/1792575441644-merging-windows-gpu-split-jobs-via-glsl-on-debug-i.md), [API-split jobs silently ignore cross-API unit tests](../learnings/1792579623451-windows-gpu-slang-test-api-split-jobs-silently-ign.md)).

The first real PR run of #13813 (run 39587814350, head 71dbcc1) measured the merged jobs at **Debug 90.8 min** (Test Slang 55.8 + via-glsl 33.6) and **Release 21.5 min** (Test Slang 14.5 + via-glsl 5.2). The same PR raised `ci-slang-test.yml` `test-slang` `timeout-minutes` from 80 (`ci-slang-test.yml:71`) to 120. That value applies to every caller of the reusable workflow, not only the Windows GPU jobs, because the PR added no per-caller `timeout-minutes` input. Debug now uses about 76% of the 120 min, so about a quarter of headroom is left before the shared timeout bites ([merged job measured: Debug 90.8 / Release 21.5 min](../learnings/1792592295131-merged-windows-gpu-ci-job-api-all-measured-debug-9.md)).

## Projecting a job's time before it runs

Two projection methods gave the same answer, 85–90 min for the merged Debug job and 18–22 min for Release, and the measurement confirmed both. The first takes the merged main step as 0.50–0.57 × the sum of the split `Test Slang` steps (the ratio measured before the split, 45–52 min against 28 + 35 + 28), then adds the measured via-glsl step and setup. The second starts from the pre-split single job (about 45 min) and adds the split via-glsl step. Use the first method to size a similar split or merge, and put a timeout change in the same PR when the projection crosses the current limit ([merged job measured: Debug 90.8 / Release 21.5 min](../learnings/1792592295131-merged-windows-gpu-ci-job-api-all-measured-debug-9.md), [merging the split jobs: Debug via-glsl ~32 min blows the 80-min timeout](../learnings/1792575441644-merging-windows-gpu-split-jobs-via-glsl-on-debug-i.md)).

A measurement of a bot's own change is usually not available before a maintainer acts. `ci.yml` `filter.if` skips only `pull_request` events on drafts, so a draft PR has no PR-event CI. The bot can still run `gh workflow run ci.yml --ref <branch>` (ci.yml:53-62), but that dispatch yields to human and merge-queue CI and is currently deadlocked behind the `falcor-ci` approval gate, so it may never reach build or test. Even when a dispatch does run, it skips the steps that `ci-slang-test.yml` gates on `github.event_name == 'pull_request'`: `Test Slang via glsl` (line 270) and `Run Slang examples` (line 257). Its job wall-clock therefore understates PR time. Add the via-glsl time from a real PR run (about 32–34 min Windows Debug, 4–5 min Release as of 2026-10-21) and label the total a projection ([dispatch CI skips via-glsl and examples](../learnings/1792575606172-bot-draft-pr-ci-via-workflow-dispatch-skips-via-gl.md)). A PR that changes `.github/workflows/` is worse off: the bot must open it from the `slang-coworkers` fork, and `gh workflow run` cannot find a branch that exists only there (see [token boundaries](agent-github-token-boundaries-and-write-blocks.md)). Its first CI comes only when a maintainer marks it ready. A push while that run is in flight cancels it (cancel-in-progress), so hold follow-up commits until the run finishes ([merged job measured: Debug 90.8 / Release 21.5 min](../learnings/1792592295131-merged-windows-gpu-ci-job-api-all-measured-debug-9.md)).

## Measuring step and unit-test times from CI logs

Step times come from `gh api repos/shader-slang/slang/actions/jobs/<id> --jq '.steps[] | ...'`. Jobs older than about 60 days return an empty `steps` array, so for those only the job-level `started_at` / `completed_at` remain ([merging the split jobs: Debug via-glsl ~32 min blows the 80-min timeout](../learnings/1792575441644-merging-windows-gpu-split-jobs-via-glsl-on-debug-i.md)).

The CI logs carry no per-test durations for slang-unit-test-tool, but the tail can still be measured. Fetch the log with `gh run view <run> --job <id> --log`, not `gh api .../actions/jobs/<id>/logs` (which refuses to print escape sequences without `--allow-escape-sequences`). Take the timestamp (third tab-separated field) of each `passed test: 'slang-unit-test-tool/<name>.internal'` line. The phase length is the last timestamp minus the first. The time saved by skipping a set S of tests is the last completion minus the last completion not in S. On 1d24bd08a (2026-10-21) the Windows Debug unit-test phase ran 395–479 s, and the `testServer*` / `Slangc*` / `DepfileOutput` set filled its final 130–159 s (#13812) ([measuring unit-test tail time from slang CI logs](../learnings/1792577720934-measuring-unit-test-tail-time-from-slang-ci-logs.md)).

**Source learnings (5):**

- [Merging Windows GPU split jobs: via-glsl on Debug is ~32m, which blows the 80m test-slang timeout](../learnings/1792575441644-merging-windows-gpu-split-jobs-via-glsl-on-debug-i.md) — split-era step times, 85–90 min Debug projection, raise the timeout in the same PR; `steps` empty after ~60 days
- [Windows GPU slang-test: API-split jobs silently ignore cross-API unit tests; merged job ≈0.5× split sum](../learnings/1792579623451-windows-gpu-slang-test-api-split-jobs-silently-ign.md) — `sharedBuffer*ToCUDA` ignored in every split job; 0.50–0.57× ratio; #13298 not caused by the merge
- [Merged Windows GPU CI job (-api all) measured: Debug 90.8 min, Release 21.5 min](../learnings/1792592295131-merged-windows-gpu-ci-job-api-all-measured-debug-9.md) — run 39587814350; timeout 120 for all callers; projection method held; cancel-in-progress on a fork draft
- [Bot draft-PR CI via workflow_dispatch skips via-glsl and examples (pull_request-only steps)](../learnings/1792575606172-bot-draft-pr-ci-via-workflow-dispatch-skips-via-gl.md) — dispatch wall-clock understates PR time; add measured via-glsl and label a projection
- [Measuring unit-test tail time from slang CI logs](../learnings/1792577720934-measuring-unit-test-tail-time-from-slang-ci-logs.md) — timestamps on `passed test:` lines; skip-set savings; use `gh run view --log`

_Catalog: [[wiki/index.md]]_
