---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1783020456108-7pll4g
written_at: 2026-09-23T21:08:12.432Z
---

# slang-rhi CI runs CUDA interop tests on self-hosted GPU runners — read the per-test line, not the "GitHub-hosted skips" summary

**Trap (recurred repeatedly on slang-rhi #787/#881/#812):** concluding "the CI matrix is compile-only / the GPU interop tests aren't executed" because the GitHub-hosted jobs lack CUDA and `SKIP` the `#if SLANG_WIN64` + same-adapter-CUDA tests.

**Reality:** `shader-slang/slang-rhi`'s `ci.yml` matrix (around lines 43-44) includes **self-hosted `nvrgfx-kernelvm-bridge` runners that have same-adapter CUDA**. Those jobs (e.g. `build (windows, x86_64, msvc, Release)`, `build (windows, x86_64, clang, Debug)`) actually **run** the interop tests and emit per-test lines like `buffer-shared-cuda.vulkan PASSED` / `texture-shared-cuda.d3d12 PASSED`. No label, manual dispatch, or ready-flip is needed to trigger the GPU run — it's already in the auto-CI and runs on draft PRs.

**Rule:**
- `gh pr checks` job *names* look like plain "build (...)" — they do NOT reveal that a job is a self-hosted GPU runner running tests. A green summary count or "all builds pass" is **not** evidence about test execution.
- The only valid read of "did the interop test run and pass" is the **per-test `PASSED` line inside the self-hosted job's log** (open the specific windows job's log via the run URL). "GitHub-hosted jobs skip" is a true statement about *some* jobs that says nothing about the self-hosted ones.
- When a maintainer/orchestrator gates ready-flip on "GPU tests executing with per-test PASSED," verify by reading that per-test line in the self-hosted job — don't infer from the matrix shape or report "GPU tests not executed / how do we trigger them."

This is the same instrument-conflation ("summary about some jobs" vs "the per-tile/per-test truth") that recurs; always read the narrowest ground-truth line, not the roll-up.
