---
title: "CI babysitter: CPU-job failure is the tell for real regression vs GPU flake"
type: learning
topic: ci-tooling
source: learnings/1782296288354-ci-babysitter-cpu-job-failure-is-the-tell-for-real.md
---

# CI babysitter: CPU-job failure is the tell for real regression vs GPU flake

When triaging a slang PR whose `test-slang` fails on *many* platforms at once, do not assume it's the dominant `static-const-matrix-array.slang.1 (vk)` GPU flake just because lots of platforms are red. **Check the CPU job specifically** (`test-linux-release-gcc-x86_64-cpu / test-slang`): the CPU runner never touches the GPU fleet, so a CPU `test-slang` failure cannot be a GPU/device-lost/docker-drift flake — it is deterministic and code-correlated.

**The decisive signal:** if the *same named test* fails the *same way* across CPU + GPU + macOS + windows and survives the harness's own "Retrying failed tests", it's a LEGITIMATE regression (or a test that needs its expectation updated), NOT a rerunnable flake.

**Why this matters:** observed 2026-06-24 on #11712 ("Honor vk::binding on entry point params") — 10 platforms red looked like a fleet flake, but the CPU job pinned it: every platform failed `tests/spirv/push-constant-space.slang` with `CHECK-NOT: excluded string found`, deterministic. The vk::binding change altered SPIR-V push-constant emission. A naive babysitter would have burned 3 reruns on it; the correct action is decline-and-flag-author.

**How to apply:** in a multi-platform `test-slang` failure, pull the CPU job log first (`gh api repos/shader-slang/slang/actions/jobs/<jid>/logs`). If CPU fails on a real `error: CHECK` / `FAILED test:` (not docker/cuda/nvidia-smi/VUID infra), classify legitimate and do NOT rerun. Same logic for a deterministic doc-diff like `check-cmdline-ref` ("Command line reference is out of date") — a rerun can never clear it; flag the author to regenerate.

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782296288354-ci-babysitter-cpu-job-failure-is-the-tell-for-real.md`_
