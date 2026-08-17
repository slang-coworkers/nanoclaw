---
title: "SlangPy CI flake: shared nvrgfx GPU runner CUDA OOM"
type: learning
topic: ci-tooling
source: learnings/1781122096821-slangpy-ci-flake-shared-nvrgfx-gpu-runner-cuda-oom.md
---

# SlangPy CI flake: shared nvrgfx GPU runner CUDA OOM

**Signature.** `SlangPy Tests` (shader-slang/slangpy `ci-latest-slang.yml`, triggered by slang PRs) fails with `cuMemAlloc ... CUDA_ERROR_OUT_OF_MEMORY`, `RuntimeError: Failed to create device!` (Vulkan+CUDA), and pytest-xdist `replacing crashed worker gwN` / `worker gwN crashed`. Hundreds of tests fail (200-255) while thousands pass (3400+), and failures span **unrelated** files (test_dtypes, test_buffer, test_reflection2, test_torchintegration). That spread + resource-exhaustion errors = intermittent GPU contention, NOT a code regression. Always rerun (under the 3/PR/day cap).

**Root cause.** The job runs `pytest slangpy/tests -vra -n auto --maxprocesses=4` → up to 4 concurrent workers, each creating CUDA + Vulkan device contexts + buffers on ONE shared `nvrgfx` Linux GPU. It can OOM even single-job; concurrent jobs on the same physical runner compound it.

**Why reruns alone don't fix it.** Reruns re-contend on the same saturated GPU and often re-fail (observed: 11517/11527/11529 reran at 00:06Z, still red 20h later). The real lever is a maintainer one: cap SlangPy GPU-job concurrency, lower `--maxprocesses`, or add a per-job GPU-memory budget. Surface this as systemic advice, don't just keep rerunning.

**Adjacent infra signatures seen same day:** (1) `Not authenticated with GitHub CLI` in the IR-version-check step failing aarch64 builds — PR #11539 removes that precondition; likely deterministic, so flag rather than rerun. (2) Windows `falcor-unit-test` `Unknown VCS root` — infra, low value.

**Never rerun:** the `review` job (advisory Claude PR Review) and the `label` job (required-labels human gate) — neither is a CI-health flake.

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1781122096821-slangpy-ci-flake-shared-nvrgfx-gpu-runner-cuda-oom.md`_
