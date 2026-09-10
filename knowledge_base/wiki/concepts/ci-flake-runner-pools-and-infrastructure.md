---
title: "CI Flake Triage — Runner Pools and Infrastructure"
type: concept
group: ci-tooling
tags: [ci, flakes, runners, runner-pools, self-hosted, gpu, disk-space, queue-timeout, pool-lottery, slang]
source_count: 4
---

# CI Flake Triage — Runner Pools and Infrastructure

The self-hosted GPU/perf fleet that shader-slang/slang CI actually runs on, how to identify which physical box a job landed on, and why a failure pinned to one bad runner is usually a *pool lottery* (rerun on a different member) rather than a futile reland. This is the infrastructure layer under [rerun decision rules](ci-flake-rerun-decision-rules.md) and [flake-vs-real classification](ci-flake-known-signatures-and-classification.md).

## TL;DR

- The fleet is **not one homogeneous pool** — a Windows GPU pool (`win-test-*`, labels `[Windows, self-hosted, test]`) and a Linux GPU fleet (`2u1g-*`), *plus* two separate perf/benchmark pools (`[Windows, self-hosted, perf]` ≠ `[Windows, self-hosted, benchmark]`). Always grep the actual `runs-on:` line before naming a pool.
- The Windows pool is **heterogeneous**: individual machines can run low on disk while neighbours are healthy. A Windows GPU test job finishing in under ~60 s usually means no tests ran (disk-space/artifact preflight), not a real result.
- **Resolve runner identity from the API, not the display name.** `Machine name: 'SLANG-WINDOWS-2'` is an image-baked pool name, not a physical host. Use `runs/<id>/jobs --jq '.jobs[]|{runner_name,conclusion}'` (per-attempt: `runs/<id>/attempts/<N>/jobs`).
- **`runner_name == ""` + `steps == []` + elapsed exactly at the job timeout ⇒ the job never ran** — it queued for a runner that never came online. Escalate the missing runner; do not rerun.
- **A runner-scoped defect makes a rerun a POOL LOTTERY, not a futile reland** — *whenever* `runs-on:` is a label set (dispatch goes to whichever member is free). With ≥3 members and ≥2 healthy, a rerun is a cheap probabilistic remedy with good odds.
- Two riders on runner attribution:
  - **The defect can be one mechanism on an otherwise-healthy box** — check for a within-window, same-box success on a *sibling* job before asking to recycle the runner, or the escalation is rejected as unfounded.
  - **Prove attribution with a differential over `runner_name`, not over time** — tabulate every instance of the failing job repo-wide in the window by runner; a clean split (one box N/N failing, siblings M/M green on the identical job) is far stronger than "it failed twice in a row."

## Runner Pools and Infrastructure

shader-slang/slang maintains two self-hosted GPU runner pools on GCP: a Windows GPU pool (`win-test-*` machines, labels `[Windows, self-hosted, test]`) for T4-based jobs, and a Linux GPU runner fleet (`2u1g-*` machines). The Windows pool is heterogeneous; individual machines (e.g. `SLANG-WINDOWS-2`) can run low on disk while neighbours are healthy, and a Windows GPU test job that completes in under ~60 seconds usually means no actual tests ran — a disk-space preflight failure or artifact-download failure, not a real test result. When one bad runner in the pool is repeatedly assigned, multiple PRs can fail the same Windows test job within ~6 seconds of each other, producing a cluster that looks like a flake but is really one sick box ([Slang CI: Windows test-slang disk-space cluster flake](../learnings/1780200309948-slang-ci-windows-disk-space-cluster-flake.md)). There are also two separate self-hosted perf/benchmark pools — `[Windows, self-hosted, perf]` is distinct from `[Windows, self-hosted, benchmark]` and used by different workflows; always grep the actual `runs-on:` line before citing which pool a workflow uses ([slang CI: two distinct self-hosted runner pools (perf vs benchmark); #11501↔#11485 perf-CI overlap cross-linked](../learnings/1780769337150-slang-ci-two-distinct-self-hosted-runner-pools-per.md)).

To identify which specific runner a job ran on: `gh api repos/shader-slang/slang/actions/runs/<run-id>/jobs --jq '.jobs[] | select(.name | contains("test-windows-release-cl-x86_64-gpu")) | {runner_name, conclusion}'`. `Machine name: 'SLANG-WINDOWS-2'` in a log is an image-baked pool name, not a physical host — resolve real identity via the jobs API. For per-attempt runner assignment, read `actions/runs/<id>/attempts/<N>/jobs`, which carries the runner each attempt landed on.

When a job shows `runner_name == ""` and `steps == []` with elapsed time exactly at the job timeout, the job never ran — it sat in queue waiting for a runner that never came online. Rerunning is futile; escalate the missing runner ([Distinguish missing-runner queue-timeout from a real test hang (gh api job runner/steps)](../learnings/1782605298157-distinguish-missing-runner-queue-timeout-from-a-re.md)).

**A runner-scoped defect makes a rerun a pool lottery, not a futile reland — and the defect can be job-scoped, so "reboot the box" is usually the wrong ask.** When a failure is pinned to one bad self-hosted runner, the tempting conclusion is "rerunning could just land on the same box." That is wrong whenever `runs-on:` is a **label set** (`[Windows, self-hosted, regression-test]`) rather than a named host — dispatch goes to whichever pool member is free, so with ≥3 members and ≥2 healthy a rerun is a cheap probabilistic remedy with good odds. Measured on a controlled within-PR experiment (slang#12322, unchanged head `ba156ebf`): attempts 1–2 on SLANGWIN5 gave `spirv-val [ 0 / 866 ]` ❌, attempt 3 on SLANGWIN4 gave `[ 866 / 866 ]` ✅ — the runner attribution was right (proven by the differential) but the "reruns are futile" remedy conclusion was wrong ([a rerun is a pool lottery, not a futile reland](../learnings/1785838439742-runner-scoped-ci-defect-a-rerun-is-a-pool-lottery-.md)). Two riders. **The defect can be one mechanism on an otherwise-healthy box:** on that same SLANGWIN5 in the same window `test-benchmark` (4/4), `test-falcor`, and an MDL-benchmark `build` all succeeded while only `test-compile-regression`'s SPIR-V validation failed 3/3 — so check for a **within-window, same-box success on a sibling job** before asking to recycle the runner, or the escalation gets rejected as unfounded. And **prove the attribution with a differential over the runner, not over time:** enumerate every instance of the failing job repo-wide in the window and tabulate by `runner_name` (from `actions/runs/<id>/attempts/<N>/jobs`, which carries per-attempt runner assignment); a clean split — one box N/N failing, siblings M/M green on the identical job — is far stronger than "it failed twice in a row."

**Source learnings (4):**
- [Runner-scoped CI defect: a rerun is a POOL LOTTERY, not a futile reland — the defect can be job-scoped; prove attribution by a differential over runner_name](../learnings/1785838439742-runner-scoped-ci-defect-a-rerun-is-a-pool-lottery-.md)
- [Windows disk-space cluster flake](../learnings/1780200309948-slang-ci-windows-disk-space-cluster-flake.md)
- [Two distinct self-hosted runner pools (perf vs benchmark)](../learnings/1780769337150-slang-ci-two-distinct-self-hosted-runner-pools-per.md)
- [Distinguish missing-runner queue-timeout from a real test hang](../learnings/1782605298157-distinguish-missing-runner-queue-timeout-from-a-re.md)
_Catalog: [[wiki/index.md]]_
