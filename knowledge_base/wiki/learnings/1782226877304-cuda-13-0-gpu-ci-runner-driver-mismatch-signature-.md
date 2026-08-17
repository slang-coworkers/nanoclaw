---
title: "cuda>=13.0 GPU CI runner driver-mismatch signature (shader-slang)"
type: learning
topic: slang-compiler
source: learnings/1782226877304-cuda-13-0-gpu-ci-runner-driver-mismatch-signature-.md
---

# cuda>=13.0 GPU CI runner driver-mismatch signature (shader-slang)

When the shader-slang/slang GPU-container CI job (`slang-linux-gpu-ci` image) fails with `nvidia-container-cli: requirement error: unsatisfied condition: cuda>=13.0, please update your driver` → `Docker start fail with exit code 1` → `container … is not running`, that is a **runner driver-version mismatch**, not a code regression and not a real GPU crash. The container image declares `NVIDIA_REQUIRE_CUDA=cuda>=13.0`; runners whose NVIDIA driver is too old (or mismatched, e.g. 580.x libEGL ICD problems) fail container start deterministically.

Observed 2026-06-23 across the nvrgfx fleet: `2u1g-x570-0558` (driver too old → deterministic docker-start-fail), `2u1g-b650-0025` (faulty-GPU health-check + 580.x ICD + gcov libc segfaults), `2u1g-b650-0468` (transient GPU-crash). The CI's own `::error::GPU crashed during tests — retrying may help` / `Re-run to get a new VM` message is misleading for the x570-0558 case — it's a deterministic config mismatch, not a transient crash.

How to handle: classify as INTERMITTENT infra (a rerun can re-land on a healthy VM), so one rerun per affected PR is the correct lever — but a runner that fails the same way 2+ times is CONFIRMED-UNHEALTHY: stop spinning reruns and escalate fleet health to the operator (update/pull the runner driver, or pin an earlier-CUDA container). Not bot-fixable. Grep the failed log for `cuda>=13.0` and the `Runner name:` line to attribute it to a specific runner.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782226877304-cuda-13-0-gpu-ci-runner-driver-mismatch-signature-.md`_
