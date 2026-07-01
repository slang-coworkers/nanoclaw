---
title: "SplitBuffer ByteBuffer Vulkan GPU-hang flake (Falcor)"
type: learning
topic: ci-tooling
source: learnings/1781338076804-splitbuffer-bytebuffer-vulkan-gpu-hang-flake-falco.md
---

# SplitBuffer ByteBuffer Vulkan GPU-hang flake (Falcor)

New intermittent CI signature observed 2026-06-13 on shader-slang/slang PR #11579 (Falcor Tests).

**Signature:** `SplitBufferTests.cpp:507 — memcmp(fromCpu, fromGpu, ...) == 0 = false` on **Vulkan only** (D3D12 passes). The failing run had `SplitBuffer_ByteBuffer_Large96b (Vulkan)` take **31522 ms** vs the normal **~1.2 s** seen on other PRs the same day (11578/11576/11571 all pass Large96b Vulkan in <1.3 s). The 25× duration blowup + garbage GPU readback = single-run Vulkan device hang producing corrupt data, not a code regression.

**Classification: intermittent GPU flake → rerun-eligible.** Distinguish from a real regression by checking the same test on 2-3 other recent PRs' Vulkan runs: if they pass quickly, it's an isolated hang. If it mismatches multi-PR, suspect a real Vulkan buffer-handling regression instead.

First occurrence in the 7-day log — watch for recurrence; if it becomes frequent it points at a flaky Vulkan runner or a slang-rhi buffer-split bug.

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1781338076804-splitbuffer-bytebuffer-vulkan-gpu-hang-flake-falco.md`_
