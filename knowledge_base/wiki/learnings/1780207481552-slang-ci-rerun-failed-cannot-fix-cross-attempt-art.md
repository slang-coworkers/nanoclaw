---
title: "Slang CI: `gh run rerun --failed` cannot fix 'Artifact not found' on artifact-consuming jobs"
type: learning
topic: slang-compiler
source: learnings/1780207481552-slang-ci-rerun-failed-cannot-fix-cross-attempt-art.md
---

# Slang CI: `gh run rerun --failed` cannot fix "Artifact not found" on artifact-consuming jobs

## Symptom

`test-windows-release-cl-x86_64-gpu / test-slang` (and similar artifact-consuming test jobs) fails in ~45–50s with:

```
##[error]Unable to download artifact(s): Artifact not found for name: slang-tests-windows-x86_64-cl-release
```

The `build-windows-release-cl-x86_64-gpu / build` job in the same run is `success` and `gh api repos/shader-slang/slang/actions/runs/<id>/artifacts` shows the artifact present (e.g. ~149 MB, non-zero `size_in_bytes`). Linux/macOS jobs and the Windows debug job pass on the same run. Observed on PRs 11363, 11355, 11332, 11331 (2026-05-30 → 31).

## Why `gh run rerun --failed` will NOT recover the run

`gh run rerun --failed` re-runs failed/skipped jobs but **not** their successful upstream dependencies. The upload-artifact step lives in the `build` job (success → not re-run); the `test` job is re-run as a new attempt and uses `actions/download-artifact@v4`, which by default only sees artifacts uploaded **in the same attempt** unless the workflow opts out via explicit `run-id`/`name` parameters. Sequence:

- Attempt 1 build → uploads artifact, success.
- Attempt 1 test → fails (the original infra hiccup, or the artifact has aged out of GHA's ~7-day default retention if the rerun is delayed).
- Attempt 2 (`rerun --failed`) → only test re-runs; download-artifact@v4 looks for an artifact uploaded **in attempt 2** and sees none → "Artifact not found".
- Attempt 3 → same.

You can burn through your 3-rerun-per-day quota and never recover — every rerun fails with the exact same fingerprint. Two failure shapes converge on the same symptom: (a) cross-attempt artifact scoping in download-artifact@v4, and (b) GHA's artifact retention pruning when the rerun is more than ~7 days after the original build. Both are unfixable by `--failed`.

## What to do instead

1. **Stop rerunning** as soon as you see "artifact exists in API but download-artifact reports not found" on a rerun attempt. Burning quota is worse than reporting.
2. Recovery has to come from a maintainer:
   - Push a new commit (or empty commit) to the branch — creates a fresh run where build+test share attempt 1.
   - Or `gh run rerun <id>` (no `--failed`) — reruns the whole workflow including build (regenerates artifact). Higher cost; not a `--failed` rerun, so check the babysitter "Only rerun `--failed`" rule first.
   - Or amend the workflow to make download-artifact attempt-agnostic (pass `run-id: ${{ github.event.workflow_run.id }}`, deterministic artifact names allowing cross-attempt download).
3. Surface the issue in your sweep summary so the maintainer knows the babysitter can't recover these PRs.

## How to detect quickly

Two signals together are decisive:

- Test job duration < 60s (no actual tests ran).
- Error string is exactly `Unable to download artifact(s): Artifact not found for name: <artifact>`.
- AND `gh api repos/<org>/<repo>/actions/runs/<run_id>/artifacts` lists `<artifact>` with a non-zero `size_in_bytes` (or, if pruned, the build job's `completed_at` is >7 days before the test attempt's `started_at`).

If all three hold, do not rerun — record in tracker and report up.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1780207481552-slang-ci-rerun-failed-cannot-fix-cross-attempt-art.md`_
