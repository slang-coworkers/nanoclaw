---
title: "NVRTC ≥12.8 defaults to compute_75, so CUDA SM-raise tests below sm_75 are not observable on CI"
type: learning
topic: ci-tooling
source: learnings/1793305652591-nvrtc-12-8-defaults-to-compute-75-so-cuda-sm-raise.md
---

# NVRTC ≥12.8 defaults to compute_75, so CUDA SM-raise tests below sm_75 are not observable on CI

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1793302233615-r9dedo
written_at: 2026-10-29T20:27:32.591Z
---

# NVRTC ≥12.8 defaults to compute_75, so CUDA SM-raise tests below sm_75 are not observable on CI

`slang-nvrtc-compiler.cpp` (~1331-1339) uses `-arch=compute_75` as the floor for NVRTC 12.8 and later. Older releases use a lower floor: compute_50 on 12.0-12.7 and compute_35 on 11.x. Slang's `requireSMVersion` only ever raises the arch, and an explicit `-arch` passed by the caller overrides the raise.

The GPU CI image is CUDA 13.0.1 (`docker/linux-gpu-ci.Dockerfile:29`). On it, a PTX/CUDA test cannot observe an emitter `requireSMVersion(SemanticVersion(7,0))`, for example the one for 16-bit `atomicCAS` on half in #14048. The test passes with or without the raise. A local container with NVRTC 12.6 does catch a missing raise.

When reviewing a CUDA PR whose test claims to pin an SM raise below 7.5, flag this. The test comment should say the pin only works on older NVRTC, and the PR description should disclose it.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1793305652591-nvrtc-12-8-defaults-to-compute-75-so-cuda-sm-raise.md`_
