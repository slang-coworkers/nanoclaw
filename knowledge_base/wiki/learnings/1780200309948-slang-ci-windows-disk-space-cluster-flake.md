---
title: "Slang CI: Windows test-slang disk-space cluster flake"
type: learning
topic: ci-tooling
source: learnings/1780200309948-slang-ci-windows-disk-space-cluster-flake.md
---

# Slang CI: Windows test-slang disk-space cluster flake

## Pattern

`test-windows-release-cl-x86_64-gpu / test-slang` (and the `-debug-cl-` sibling) fails in **<60s** with this distinctive log signature:

```
::error::Insufficient disk space: ${avail_gb} GB available, ${min_gb} GB required
##[error]Unable to download artifact(s): Artifact not found for name: slang-tests-windows-x86_64-cl-release
```

The build job for the same OS/arch *succeeds* — only the test job fails. Failure duration is the giveaway: a real test run takes 12–60 minutes; this hits within ~50 seconds. The "Artifact not found" line is a *consequence* of the workspace being torn down after the disk-space preflight fails, not the cause — distinct from the cross-attempt artifact pattern (see `1780207481552-slang-ci-rerun-failed-cannot-fix-cross-attempt-art.md`), which has no disk-space line.

## Cluster behaviour

Comes in *waves*. On 2026-05-30 ~20:13Z, **five unrelated PRs** (#11363, #11355, #11332, #11331, #11265) all failed with this exact pattern within ~6 seconds of each other — same job pool exhausted at once. If you see one PR with this pattern, scan other recent open PRs in the same time window before classifying.

## Cause

One or more self-hosted Windows runners in the GCP-T4 pool (e.g. `win-test-308d08c5` / machine `SLANG-WINDOWS-2`) chronically run low on disk. A pre-flight disk-space check in the workflow fails the job before it can download the build artifact. Other runners in the pool (e.g. `win-test-c683124f`, `win-test-ee0b64a2`, `win-test-3a885da7`) are healthy. Whether a rerun unsticks the PR depends on which machine the queue assigns it to.

PR shader-slang/slang#11355 ("Drop CI host-disk cleanup and run container as non-root") is the structural fix in flight (still **OPEN** as of 2026-05-31). Until it lands, expect this pattern to recur.

## How to handle (CI babysitter)

- This is **infrastructure**, not a code regression — auto-rerun is correct, but a single rerun has only ~50/50 odds of getting a clean machine. Failing twice in a row on the same disk-space signature is not a code regression; it's the same bad runner being picked again.
- When you see a cluster (multiple PRs failing the same Windows test job within the same time window), it's almost always one bad runner in the pool, not a code change.
- After 2 reruns with no progress, escalate in the summary rather than burning the 3rd budget — the runner needs human intervention.
- GHA logs/artifacts expire after ~7d, so rerun classification has to happen within that window.

## Identifying the bad runner

```bash
gh api repos/shader-slang/slang/actions/runs/<run-id>/jobs --jq '.jobs[] | select(.name | contains("test-windows-release-cl-x86_64-gpu")) | {runner_name, conclusion}'
```

If the same runner name appears across multiple failing PRs, that machine is the problem.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1780200309948-slang-ci-windows-disk-space-cluster-flake.md`_
