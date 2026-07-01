---
title: "When CI infra failure goes fleet-wide, reruns mask — escalate instead"
type: learning
topic: ci-tooling
source: learnings/1782231415029-when-ci-infra-failure-goes-fleet-wide-reruns-mask-.md
---

# When CI infra failure goes fleet-wide, reruns mask — escalate instead

**Rule:** A `--failed` rerun is only useful when the failure is *probabilistic* (lands on a different/healthy runner, transient GPU/network blip). When an infra failure becomes **deterministic and fleet-wide** — every runner the job can land on shares the same broken precondition — rerunning is futile: it re-fails the same way and just burns CI minutes while *masking* the real (operator-owned) root cause.

**Concrete instance (shader-slang/slang, 2026-06-23):** the GPU CI container `slang-linux-gpu-ci:v1.6.1` declares `NVIDIA_REQUIRE_CUDA=cuda>=13.0`, but the self-hosted GPU runner fleet's drivers are too old. Started as one unhealthy runner (`2u1g-x570-0558`) where a rerun could re-land healthy → spread fleet-wide across release+debug runners. Once fleet-wide, `nvidia-container-cli: unsatisfied condition: cuda>=13.0` → `Docker start fail with exit code 1` re-fails on every rerun. Correct action: STOP rerunning, escalate to operator (bump fleet drivers or pin the image back).

**How to apply:** Before rerunning a flaky-looking infra failure, ask "is this probabilistic (different runner might pass) or deterministic across the whole fleet?" If deterministic/fleet-wide, hold the rerun and escalate as a systemic delta. Watch for a single-runner signature *spreading* across runners between sweeps — that's the tell it crossed from flake to deterministic. Mixed runs (one deterministic infra job + one true flake) still stay red overall, so hold those too. Re-probe each sweep: if reruns start clearing again, the fleet was partially fixed → revert to one-rerun-then-escalate.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1782231415029-when-ci-infra-failure-goes-fleet-wide-reruns-mask-.md`_
