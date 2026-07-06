---
title: "CI Runners & Flake Triage"
type: concept
group: ci-tooling
tags: [ci, flakes, runners, babysitter, rerun, triage, slang]
source_count: 29
---

# CI Runners & Flake Triage

How to classify Slang CI failures, decide when to rerun, and identify infrastructure vs. code regressions. Covers the babysitter rerun budget, known flake signatures, deterministic failures, and fleet-wide escalation.

## Runner Pools and Infrastructure

shader-slang/slang maintains two self-hosted GPU runner pools on GCP: a Windows GPU pool (`win-test-*` machines, labels `[Windows, self-hosted, test]`) for T4-based jobs, and a Linux GPU runner fleet (`2u1g-*` machines). The Windows pool is heterogeneous; individual machines (e.g. `SLANG-WINDOWS-2`) can run low on disk while neighbours are healthy ([Slang CI: Windows test-slang disk-space cluster flake](../learnings/1780200309948-slang-ci-windows-disk-space-cluster-flake.md)). There are also two separate self-hosted perf/benchmark pools — `[Windows, self-hosted, perf]` is distinct from `[Windows, self-hosted, benchmark]` and used by different workflows; always grep the actual `runs-on:` line before citing which pool a workflow uses ([slang CI: two distinct self-hosted runner pools (perf vs benchmark); #11501↔#11485 perf-CI overlap cross-linked](../learnings/1780769337150-slang-ci-two-distinct-self-hosted-runner-pools-per.md)).

To identify which specific runner a job ran on: `gh api repos/shader-slang/slang/actions/runs/<run-id>/jobs --jq '.jobs[] | select(.name | contains("test-windows-release-cl-x86_64-gpu")) | {runner_name, conclusion}'` ([Slang CI: Windows test-slang disk-space cluster flake](../learnings/1780200309948-slang-ci-windows-disk-space-cluster-flake.md)).

When a job shows `runner_name == ""` and `steps == []` with elapsed time exactly at the job timeout, the job never ran — it sat in queue waiting for a runner that never came online. Rerunning is futile; escalate the missing runner ([Distinguish missing-runner queue-timeout from a real test hang (gh api job runner/steps)](../learnings/1782605298157-distinguish-missing-runner-queue-timeout-from-a-re.md)).

## Rerun Decision Rules

**Core rule:** `gh run rerun --failed` re-runs failed jobs but NOT their successful upstream dependencies. For artifact-consuming test jobs, `download-artifact@v4` by default only sees artifacts uploaded in the same attempt — so if the build job is marked success, a `--failed` rerun of only the test job will fail with "Artifact not found" every attempt, burning the entire rerun budget ([Slang CI: `gh run rerun --failed` cannot fix 'Artifact not found' on artifact-consuming jobs](../learnings/1780207481552-slang-ci-rerun-failed-cannot-fix-cross-attempt-art.md)). Recovery requires a maintainer to push a new commit (fresh full run) or `gh run rerun <id>` (no `--failed`) to rerun the whole workflow.

**Cluster detection:** Before rerunning anything, check whether the same error signature appears on two or more unrelated PRs. Same deterministic error across unrelated PRs = base-branch break, not a flake. Do NOT rerun — rerunning re-hits the same broken base and wastes the budget ([CI babysitter: identical build error across unrelated PRs = base-branch break, not flake](../learnings/1780790667002-ci-babysitter-identical-build-error-across-unrelat.md)). Windows disk-space failures often cluster: multiple PRs fail the same Windows test job within 6 seconds of each other when one bad runner in the pool is assigned repeatedly ([Slang CI: Windows test-slang disk-space cluster flake](../learnings/1780200309948-slang-ci-windows-disk-space-cluster-flake.md)).

**Standing escalations skip reruns entirely:** when a persistent infra problem is already routed to an infra owner (runner starvation: job CANCELLED after "awaited a runner for 24h0m0s"; materialx Docker-pull loop; nvrgfx/SlangPy CUDA-OOM), do NOT rerun — the fix is operator-side, not a retry ([Slang CI babysitter: skip reruns on standing-escalated infra failures](../learnings/1781195910201-slang-ci-babysitter-skip-reruns-on-standing-escala.md)).

**Fleet-wide deterministic failures:** a `--failed` rerun is only useful when the failure is probabilistic (can land on a different/healthy runner). When every runner in the fleet shares the same broken precondition (e.g. `cuda>=13.0` driver-mismatch fleet-wide), reruns mask the problem rather than fixing it — escalate to operator ([When CI infra failure goes fleet-wide, reruns mask — escalate instead](../learnings/1782231415029-when-ci-infra-failure-goes-fleet-wide-reruns-mask-.md), [CI babysitter: headline the dominant root-cause when maintainers rerun into a deterministic wall](../learnings/1782248669315-ci-babysitter-headline-the-dominant-root-cause-whe.md)). The CUDA ≥13.0 container failure (`nvidia-container-cli: requirement error: unsatisfied condition: cuda>=13.0`) starts as a single unhealthy runner (one rerun OK) but can spread fleet-wide; once fleet-wide, stop rerunning ([cuda>=13.0 GPU CI runner driver-mismatch signature (shader-slang)](../learnings/1782226877304-cuda-13-0-gpu-ci-runner-driver-mismatch-signature-.md)).

## Classifying Failures: Flake vs. Legitimate

**Test duration is a fast signal.** A Windows GPU test job completing in under 60 seconds means no actual tests ran — likely a disk-space preflight failure or artifact download failure, not a real test result ([Slang CI: Windows test-slang disk-space cluster flake](../learnings/1780200309948-slang-ci-windows-disk-space-cluster-flake.md), [Slang CI: `gh run rerun --failed` cannot fix 'Artifact not found' on artifact-consuming jobs](../learnings/1780207481552-slang-ci-rerun-failed-cannot-fix-cross-attempt-art.md)).

**CPU-job failure pins legitimacy.** The CPU runner (`test-linux-release-gcc-x86_64-cpu / test-slang`) never touches the GPU fleet. If the same named test fails identically on the CPU job AND multiple GPU/macOS/Windows jobs, it cannot be a GPU/infra flake — it is a deterministic regression requiring author action, not a rerun ([CI babysitter: CPU-job failure is the tell for real regression vs GPU flake](../learnings/1782296288354-ci-babysitter-cpu-job-failure-is-the-tell-for-real.md)).

**Deterministic build/link errors are never rerunnable** (unless the stale-base exception applies; see below). Grep the failed log for `undefined symbol`, `error C####`, `LNK####`, `FAILED:` (ninja) before classifying any build failure as flaky ([Slang CI: wasm build failures are usually real linker errors, not infra](../learnings/1780920419175-slang-ci-wasm-build-failures-are-usually-real-link.md)). WASM `build-linux-release-gcc-wasm / build` undefined-symbol linker errors for `LanguageServerCore::*` / `WorkspaceVersion::*` are a known base-branch break signature — do NOT rerun ([Slang CI: WASM link regression + slang-rhi timing flake signatures](../learnings/1780891496263-slang-ci-wasm-link-regression-slang-rhi-timing-fla.md)).

**Stale-base exception:** if a build failure is clearly unrelated to the PR's diff (e.g. a pure CI-YAML PR producing C++ linker errors) AND current main builds clean for the same job, the PR's run is against a stale base — rerunning via `gh run rerun --failed` re-checks-out `refs/pull/N/merge` against current main and should clear. Distinguish from an active base break by checking a recent green run of the same job on another PR ([CI babysitter: stale-base build/link failures are rerunnable despite the 'no linker errors' rule](../learnings/1780985285213-ci-babysitter-stale-base-build-link-failures-are-r.md)).

**Merge-group collisions are legitimate, not flakes.** When a merge-group run fails with a build error (e.g. `duplicate case value`) while the PR's own head checks are green, two PRs in the merge queue introduced the same enum value — this is a real source-level conflict. Do NOT requeue; the author must rebase and renumber ([Merge-group build break with green head = merge-time collision, legitimate not flake](../learnings/1782533107353-merge-group-build-break-with-green-head-merge-time.md)).

**XPASS (unexpected pass) is author-owned.** If a test the PR fixes is still listed in an `expected-failure*.txt` file, the harness reports XPASS as a failure. It reproduces identically on the CPU job AND every GPU platform. Do not rerun — the author must remove the test from the expected-failure list ([XPASS is a deterministic author-owned CI failure, not a flake or regression](../learnings/1782360530038-xpass-is-a-deterministic-author-owned-ci-failure-n.md)).

**check-cmdline-ref failures are always deterministic** — a rerun will never clear them. They are almost always caused by the PR itself (changes to `slang-options.cpp` without regenerating docs, or an incorrect doc edit) rather than master-wide staleness ([Attributing check-cmdline-ref CI failures (not master-doc drift by default)](../learnings/1782324937326-attributing-check-cmdline-ref-ci-failures-not-mast.md)).

## Known Flake Signatures

**slang-rhi cmd-query timing flake** (`test-cmd-query.cpp:183: CHECK(durationGPU < durationCPU) is NOT correct!`) on macOS aarch64: a timing assertion sensitive to scheduler jitter. Both durations can round to the same value (`7e-06 < 7e-06`), causing strict `<` to fail. Auto-rerun eligible IF it is the sole failure on an otherwise-green PR ([Slang CI: WASM link regression + slang-rhi timing flake signatures](../learnings/1780891496263-slang-ci-wasm-link-regression-slang-rhi-timing-fla.md), [slang #11641 mac-aarch64 rhi flake = cmd-query timing assert (slang-rhi#775), NOT LLVM instruction-set](../learnings/1781679288468-slang-11641-mac-aarch64-rhi-flake-cmd-query-timing.md), [CI babysitter: stale-base build/link failures are rerunnable despite the 'no linker errors' rule](../learnings/1780985285213-ci-babysitter-stale-base-build-link-failures-are-r.md)). The upstream fix (slang-rhi#775, loosening `<` to `<= + tolerance`) must be live in the slang repo's submodule pin to take effect — verify with `gh api repos/shader-slang/slang-rhi/compare/<fix-sha>...<pin-sha> --jq '{status,behind_by}'`.

**Falcor image-test flake** (single isolated image-comparison diff, e.g. `renderpasses/test_GBufferRTTexGrads_d3d12 : FAILED` on `build (windows, release, cl, x86_64)`): if the PR doesn't touch rendering, this is almost certainly a GPU image-comparison flake. Rerun with `gh run rerun <id> --failed` ([Slang CI: Falcor image-test flakes vs artifact-not-found classification](../learnings/1780762074181-slang-ci-falcor-image-test-flakes-vs-artifact-not-.md)).

**Falcor `Unknown VCS root` harness failure** (exit code 1, "Error. Unknown VCS root") is a systemic infra signature that hits many independent PRs in the same time window. Do NOT rerun — record and surface to maintainers ([Slang CI: falcor-unit-test 'Unknown VCS root' is systemic infra, do not rerun](../learnings/1781136348152-slang-ci-falcor-unit-test-unknown-vcs-root-is-syst.md)).

**"Common Test Setup" pre-test failure** on Windows GPU runners (SLANG-WINDOWS-*): job dies in the pre-test setup step before any test runs, and evicts PRs from the merge queue. Auto-rerun eligible for head checks; for merge-group evictions use Merge Queue Recovery. Fork PRs cannot be requeued by the bot (returns "You're not authorized to push to this branch") ([Slang CI: 'Common Test Setup' pre-test flake evicts PRs from merge queue](../learnings/1781626237709-slang-ci-common-test-setup-pre-test-flake-evicts-p.md)).

**JSON-RPC failure** (`waitForResult()`/`hasMessage()`) means the test-server child process died mid-test (the stdio pipe hit EOF). This is a symptom of a crash/abort inside the test, NOT an RPC-infrastructure bug. Since PR #11753 fixed the `runUnitTestModule()` stale-pass bug, crashing unit tests correctly record failure instead of silently passing ([slang CI: JSON RPC failure on a unit test = test-server child crash (symptom), not an RPC-infra bug](../learnings/1782407732117-slang-ci-json-rpc-failure-on-a-unit-test-test-serv.md)). The JSON-RPC failure surface conflates three distinct root causes: (a) genuine harness flake (CPU concurrency on aarch64), (b) GPU device-loss/faulty-ICD killing the worker, and (c) the PR's own consistently-failing test crashing the worker. Deduplicate by distinct run id before counting; exclude (b) and (c) from the harness-flake count ([Flaky-CI evidence: dedup by run id; JSON-RPC and Falcor symptoms each conflate multiple root causes](../learnings/1782598546890-flaky-ci-evidence-dedup-by-run-id-json-rpc-and-fal.md)).

**Bot-CI priority-yield** (`ci_failed` with every build/test job `skipped` and only `wait-for-human-priority` + `check-ci` failing): the bot CI yielded to higher-priority human CI and `retry-yielded-bot-ci.yml` will self-heal it. Do NOT rerun — rerunning re-enters the same gate ([slang bot-CI 'ci_failed' is often a priority-yield (self-heals via retry-yielded-bot-ci) — do NOT rerun or treat as code failure](../learnings/1781571803229-slang-bot-ci-ci-failed-is-often-a-priority-yield-s.md)).

**Cooperative-vector HLSL codegen failure** (two specific tests `tests/cooperative-vector/matrix-mul-hlsl-codegen.slang.1` and `tests/cooperative-vector/training-hlsl-codegen.slang.1` failing deterministically on `test-windows-release-cl-x86_64-gpu` across 8+ unrelated PRs): DXC version mismatch on that runner — do NOT rerun, classify as "blocked on fix PR" ([Slang CI: cooperative-vector hlsl-codegen tests fail on Windows-release-GPU pre-#11358](../learnings/1780157118768-slang-ci-cooperative-vector-tests-fail-on-windows-.md)).

**slang-module gen failure with `E99997` / SIGABRT** on debug build jobs: a deterministic in-process compiler assert = real code bug in the PR under test. Do NOT rerun. Contrast with a silent exit-1 with no diagnostic (transient bootstrap crash = rerun-eligible) ([Slang CI: .slang-module gen failure with E99997 assert = real bug, not infra flake](../learnings/1781720061070-slang-ci-slang-module-gen-failure-with-e99997-asse.md)).

**`texture-shared-cuda.vulkan` numeric flake** on `test-windows-release-cl-x86_64-gpu-rhi / test-slang-rhi`: a CUDA↔Vulkan shared-memory interop numeric-tolerance failure (`CHECK_GE(result[i], expectedResult[i] - 0.01f)` in `external/slang-rhi/tests/testing.h:228`). When it fires ~965/966 rhi cases still pass (only ~20 assertions of tens of millions), and the same suite is green on `windows-debug-gpu-rhi` and every other platform. It is PR-agnostic — observed on #11693, #11735, #11812, none touching CUDA/Vulkan shared-texture interop. Single test / single runner / passes elsewhere / PR domain unrelated to interop → flake, rerun `--failed` under the daily cap; the `check-ci` aggregator red is just the cascade. Systemic fix (maintainer): widen the `CHECK_GE` tolerance or quarantine the test ([texture-shared-cuda.vulkan is a recurring slang-rhi interop flake](../learnings/1782936358409-texture-shared-cuda-vulkan-is-a-recurring-slang-rh.md)).

## Flake Evidence Dedup

When summarizing flake evidence from `memory/rerun-log.jsonl`, always deduplicate by distinct `run_id` or `mergeGroupRunId` — re-confirmation sweeps re-log the same eviction every 2 hours, so raw line counts can inflate counts ~6×. Also separate the Falcor timeout bucket (infra-escalation) from HSigmoid/relErr numeric-tolerance failures (external Falcor-CI-owned) and unknown-vcs-root (separate signature) ([Flaky-CI evidence: dedup by run id; JSON-RPC and Falcor symptoms each conflate multiple root causes](../learnings/1782598546890-flaky-ci-evidence-dedup-by-run-id-json-rpc-and-fal.md)).

## Reporting

When the sweep is dominated by one deterministic operator-owned root cause, lead the report with that root cause as the loud headline — "reruns futile" + name the concrete operator fix — and put per-PR tallies after. A maintainer who tries their own rerun and re-fails needs to see the root cause immediately, not buried under per-PR detail ([CI babysitter: headline the dominant root-cause when maintainers rerun into a deterministic wall](../learnings/1782248669315-ci-babysitter-headline-the-dominant-root-cause-whe.md)).

## ASan "runtime does not come first" flake + the canary-gating trap

The `sanitizer-linux-clang-x86_64` leg intermittently aborts with *"ASan runtime does not come first in the initial library list"* on the GCP linux-build pool. This is a loader-ordering/environment flake, **not** a code bug, and switching to static ASan linkage is **not** the fix. The tell is that a static "canary" preflight step is what actually gates the run, so hardening the canary (not the individual test steps) is the durable lever. Watch for the GitHub Actions `success()` trap when wiring the guard: a step that only runs on `success()` won't fire after the abort. Diagnosis + fix levers: [ASan 'runtime does not come first' CI flake — static-canary tell + why static linkage isn't the fix](../learnings/1782801882987-asan-runtime-does-not-come-first-ci-flake-static-c.md), [ASan 'runtime does not come first' CI flake — diagnosis, fix levers, and the GH Actions success() trap](../learnings/1782802321817-asan-runtime-does-not-come-first-ci-flake-diagnosi.md); the CANARY-is-the-gate correction: [CORRECTION to ASan-runtime-not-first learning — the CANARY is the gating step, harden it (not just test steps)](../learnings/1782802481315-correction-to-asan-runtime-not-first-learning-the-.md).

## A required draft-PR ci.yml workflow_dispatch can itself priority-yield

On shader-slang/slang a **draft** PR's *required* manual `gh workflow run ci.yml --ref <branch>` dispatch can itself PRIORITY-YIELD to human CI — not just the redundant non-draft dispatches. Signature: the run completes `failure` almost instantly with build/test legs skipped. Read the `pull_request` run rollup for the real head-green signal rather than trusting the manual dispatch's red ([A required draft-PR ci.yml workflow_dispatch can itself priority-yield](../learnings/1782867699255-a-required-draft-pr-ci-yml-workflow-dispatch-can-i.md)).

## supervise-issues pull-universe.sh bash-quoting bug

`bash scripts/pull-universe.sh … | python3 scripts/scan.py` exits 1 with `syntax error near unexpected token '('` at ~line 145, and scan.py then reports `stdin is not a tty` — a bash-quoting bug in pull-universe.sh (a sibling to the earlier argv-overflow issue) that aborts the supervise tick ([1782995331984-supervise-issues-pull-universe-sh-bash](../learnings/1782995331984-supervise-issues-pull-universe-sh-bash-quoting-bug.md)).

---
**Source learnings (33):**
- [Cooperative-vector tests failing deterministically on Windows-release-GPU](../learnings/1780157118768-slang-ci-cooperative-vector-tests-fail-on-windows-.md)
- [Windows disk-space cluster flake](../learnings/1780200309948-slang-ci-windows-disk-space-cluster-flake.md)
- [`gh run rerun --failed` cannot fix cross-attempt artifact-not-found](../learnings/1780207481552-slang-ci-rerun-failed-cannot-fix-cross-attempt-art.md)
- [Falcor image-test flakes vs artifact-not-found classification](../learnings/1780762074181-slang-ci-falcor-image-test-flakes-vs-artifact-not-.md)
- [Identical build error across unrelated PRs = base-branch break](../learnings/1780790667002-ci-babysitter-identical-build-error-across-unrelat.md)
- [WASM link regression + slang-rhi timing flake signatures](../learnings/1780891496263-slang-ci-wasm-link-regression-slang-rhi-timing-fla.md)
- [WASM build failures are usually real linker errors](../learnings/1780920419175-slang-ci-wasm-build-failures-are-usually-real-link.md)
- [Stale-base build/link failures are rerunnable despite the "no linker errors" rule](../learnings/1780985285213-ci-babysitter-stale-base-build-link-failures-are-r.md)
- [Falcor unit-test "Unknown VCS root" is systemic infra](../learnings/1781136348152-slang-ci-falcor-unit-test-unknown-vcs-root-is-syst.md)
- [Skip reruns on standing-escalated infra failures](../learnings/1781195910201-slang-ci-babysitter-skip-reruns-on-standing-escala.md)
- [Bot-CI "ci_failed" is often a priority-yield](../learnings/1781571803229-slang-bot-ci-ci-failed-is-often-a-priority-yield-s.md)
- ["Common Test Setup" pre-test flake evicts PRs from merge queue](../learnings/1781626237709-slang-ci-common-test-setup-pre-test-flake-evicts-p.md)
- [Bot draft PRs get zero CI](../learnings/1781663343829-bot-draft-prs-get-zero-ci-on-shader-slang-slang-fi.md)
- [Mac-aarch64 RHI flake = cmd-query timing assert](../learnings/1781679288468-slang-11641-mac-aarch64-rhi-flake-cmd-query-timing.md)
- [.slang-module gen failure with E99997 = real bug](../learnings/1781720061070-slang-ci-slang-module-gen-failure-with-e99997-asse.md)
- [CUDA ≥13.0 GPU CI runner driver-mismatch signature](../learnings/1782226877304-cuda-13-0-gpu-ci-runner-driver-mismatch-signature-.md)
- [Fleet-wide CI infra failure: reruns mask, escalate instead](../learnings/1782231415029-when-ci-infra-failure-goes-fleet-wide-reruns-mask-.md)
- [Headline the dominant root-cause in babysitter reports](../learnings/1782248669315-ci-babysitter-headline-the-dominant-root-cause-whe.md)
- [CPU-job failure is the tell for real regression vs GPU flake](../learnings/1782296288354-ci-babysitter-cpu-job-failure-is-the-tell-for-real.md)
- [Attributing check-cmdline-ref CI failures](../learnings/1782324937326-attributing-check-cmdline-ref-ci-failures-not-mast.md)
- [XPASS is a deterministic author-owned CI failure](../learnings/1782360530038-xpass-is-a-deterministic-author-owned-ci-failure-n.md)
- [CI-integrity bug: detected failure logged but not recorded (stale init=Success)](../learnings/1782392187766-ci-integrity-bug-class-a-detected-failure-is-logge.md)
- [JSON-RPC failure = test-server child crash](../learnings/1782407732117-slang-ci-json-rpc-failure-on-a-unit-test-test-serv.md)
- [Merge-group build break with green head = merge-time collision](../learnings/1782533107353-merge-group-build-break-with-green-head-merge-time.md)
- [Flaky-CI evidence: dedup by run id](../learnings/1782598546890-flaky-ci-evidence-dedup-by-run-id-json-rpc-and-fal.md)
- [Distinguish missing-runner queue-timeout from a real test hang](../learnings/1782605298157-distinguish-missing-runner-queue-timeout-from-a-re.md)
- [Two distinct self-hosted runner pools (perf vs benchmark)](../learnings/1780769337150-slang-ci-two-distinct-self-hosted-runner-pools-per.md)
- [pytest-xdist high gwN worker IDs are crash-respawns](../learnings/1781204283033-pytest-xdist-high-gwn-worker-ids-are-crash-respawn.md)

- [ASan 'runtime does not come first' flake: static-canary tell, static linkage is not the fix](../learnings/1782801882987-asan-runtime-does-not-come-first-ci-flake-static-c.md)
- [ASan flake diagnosis, fix levers, and the GH Actions success() trap](../learnings/1782802321817-asan-runtime-does-not-come-first-ci-flake-diagnosi.md)
- [CORRECTION: the canary is the gating step — harden it, not just test steps](../learnings/1782802481315-correction-to-asan-runtime-not-first-learning-the-.md)
- [A required draft-PR ci.yml workflow_dispatch can itself priority-yield](../learnings/1782867699255-a-required-draft-pr-ci-yml-workflow-dispatch-can-i.md)
- [texture-shared-cuda.vulkan is a recurring slang-rhi CUDA↔Vulkan interop numeric flake](../learnings/1782936358409-texture-shared-cuda-vulkan-is-a-recurring-slang-rh.md)
- [supervise-issues pull-universe.sh bash-quoting bug (syntax error ~line 145)](../learnings/1782995331984-supervise-issues-pull-universe-sh-bash-quoting-bug.md)
_Catalog: [[wiki/index.md]]_
