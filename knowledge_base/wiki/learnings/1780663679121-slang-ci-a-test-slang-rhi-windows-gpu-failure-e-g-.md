---
title: "Slang CI: a test-slang-rhi Windows-GPU failure (e.g. texture-shared-cuda.vulkan) is unrelated to compiler/test-only PRs — classify flaky, rerun"
type: learning
topic: slang-compiler
source: learnings/1780663679121-slang-ci-a-test-slang-rhi-windows-gpu-failure-e-g-.md
---

# Slang CI: a test-slang-rhi Windows-GPU failure (e.g. texture-shared-cuda.vulkan) is unrelated to compiler/test-only PRs — classify flaky, rerun

**Rule:** When a `github.ci_failed` webhook fires on a shader-slang/slang PR, separate the **`test-slang`** jobs (which run `tests/**/*.slang` FileCheck/compute tests — your compiler/test changes) from the **`test-slang-rhi`** jobs (which run the *external* `slang-rhi` submodule's GPU rendering/interop suite). A red `test-slang-rhi` while every `test-slang` is green means the failure is **not** from a compiler or `tests/`-only change. The `check-ci` job (≈4s) is only an aggregation gate — it goes red because some other job did; it is never the root cause.

**Why:** On PR #11484 (a single `tests/spirv/*.slang` regression test, RESOLVED-by-#11211, 0-bug review) CI went red. Triage: `gh api repos/.../actions/jobs/<id> --jq '.steps[]|"\(.conclusion)\t\(.name)"'` showed the only failing step was "Run slang-rhi tests" on `test-windows-release-cl-x86_64-gpu`; `test-slang` passed on all platforms incl. Windows GPU. The sole `FAILED` line in the job log was `texture-shared-cuda.vulkan FAILED (0.34s)` — a CUDA↔Vulkan external-memory shared-texture interop test, a classic driver/timing-flaky category on CI GPU runners, in the external slang-rhi repo. Zero relationship to a `tests/spirv` FileCheck change. (The rhi workflow even ships built-in "Add retry logic for intermittent failures / after 3 attempts" scaffolding — maintainers treat these as intermittent.)

**How to apply:** Per the `/slang-github-webhook` CI-failure path, classify infra/flaky → `gh run rerun <run-id> --failed` (NOT an edit), up to 3× for the same signature, then report to parent. Don't push test/code changes to "fix" an unrelated rhi-GPU flake — your change can't cause or cure it. Don't poll the rerun; its result returns as the next `github.ci_failed`/green webhook. Triage commands: `gh pr checks <pr>` (find the red check), `gh api repos/{repo}/actions/jobs/<jobId> --jq '.steps[]|...'` (find the failing step), then grep the saved `gh run view --job <id> --log` for the `FAILED`/`::error` lines (strip the GHA `^[[36;1m` script-echo + PATH noise).

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1780663679121-slang-ci-a-test-slang-rhi-windows-gpu-failure-e-g-.md`_
