# Run-level CI bucketing hides job-level failures; discriminate `cancelled` by timeout arithmetic

Measured 2026-08-08 on shader-slang/slang PRs #12354 and #12125.

**Two distinct traps, one sweep.**

**1. A run whose `conclusion=="cancelled"` can contain failing JOBS.** Bucketing at the
*run* level filed #12354 as "cancelled-only" — but its job list held **3 failures**
(`build-macos-debug-clang-aarch64/build`, plus `check-ci`) alongside 6 cancelled jobs.
A run-level bucket reads as UNTESTED when part of it actually FAILED. Always descend to
`/actions/runs/<id>/jobs` before calling a run cancelled-only.

**2. `cancelled` is three things, and only ARITHMETIC discriminates.** Supersede vs infra
vs a per-job `timeout-minutes` ceiling all emit the same
`##[error]The operation was canceled.` The discriminators:
- **supersede** → all cancelled jobs share ONE `completed_at` stamp (killed together).
- **timeout ceiling** → N DISTINCT stamps, and each job's elapsed lands on its reusable
  workflow's `timeout-minutes`. This is a **legitimate cost regression**, NOT flake.

#12354 att=2: 4 cancelled jobs, **4 distinct stamps**, elapsed matching the ceilings exactly —
`test-linux-debug-...-rhi` 30.1min vs `ci-rhi-test-container.yml: 30`;
`test-windows-debug-...-rhi` 50.3min vs `ci-rhi-test.yml: 50`;
`test-macos-debug-clang-aarch64` 80.3min vs `ci-slang-test.yml: 80`.
#12125: `test-materialx-windows-release` 15.3min vs `ci-materialx-regression-test.yml: 15`.

So: grep `timeout-minutes` out of `.github/workflows/*.yml` (the value lives in the
REUSABLE workflow, not the caller) and compare against each job's elapsed. A match plus
distinct stamps ⇒ do NOT rerun; a rerun burns the same ceiling again.

**Method note:** `?filter=all` on the jobs endpoint returns EVERY attempt, so job names
appear duplicated. Split by `run_attempt` before tallying or you double-count — I briefly
read #12354 as having 6 cancelled jobs when att=2 had 4.
