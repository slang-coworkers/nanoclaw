---
type: chain
title: slang-rhi#956 — WebGPU readBuffer allocates a staging buffer per call
description: PARKED on the author since 10-29 07:51Z. Triaged (bot cmt 6491098268 welcomes j8asic's PR, no bot fix); triager one-shot re-check t-9540e9 11-05 09:00Z. Couples to author's open PR #953 (same readBuffer, opened 51 s earlier) and the Vulkan sibling #862 / our draft #869.
resource: https://github.com/shader-slang/slang-rhi/issues/956
---

# slang-rhi#956 — WebGPU readback staging-buffer reuse

**Claim (reporter, unverified):** `DeviceImpl::readBuffer()` in `src/wgpu/wgpu-device.cpp` creates
and releases a `MapRead | CopyDst` staging buffer on every call. Proposal: reuse one bounded staging
buffer for small reads (mutex-guarded), keep transient buffers for large reads. Self-described
"WebGPU counterpart of #862". Author offers a PR "if the approach fits".

**Routing (10-29 ~07:50Z):** live read: open, 0 comments, no labels/assignees, body == payload,
empty timeline. R6 (nanoclaw#1993, merged 10-25) has no waiting period and only skips newcomer
labels, so normal routing applies. Only session on the thread was my own webhook session.
Dispatched to slang-triager on `gh-issue-shader-slang/slang-rhi-956`: verify at main, couple
against #953/#862/#869, post a triage comment that welcomes the author's PR. Fixer only if the
author declines or a maintainer asks — a bot fix would collide with #953.

**Coupling:**
- slang-rhi#953 (j8asic, open, non-draft, 10-29 07:43:45Z): "WebGPU: wait once per synchronous
  buffer readback" — same function, same file. Author's sibling PRs #950–#952 also open.
- slang-rhi#862 (j8asic, Vulkan counterpart, assignee jvepsalainen-nv) → our draft #869
  (`fix/issue-862`, owner slang-fixer), held awaiting maintainer. See
  [slang-rhi-928-vulkan-readback-uncached.md](slang-rhi-928-vulkan-readback-uncached.md).

**10-29 07:52Z triager [Report] (comment verified live: nv-slang-bot 07:51:22Z, 2511 chars, the
only comment):** source-confirmed at `main` d2fc6bb (`wgpu-device.cpp:471/487/492`), P3 perf
enhancement, no labels. It suggests landing #953 first. **Correction to my dispatch note:** #869
does *not* use a bounded buffer plus mutex. It routes Vulkan `readBuffer` through the shared
`m_readbackHeap` StagingHeap, so that claim was not posted. New WebGPU finding (triager's, posted):
the shared-heap path waits queue-wide via `waitOnHost()` (`wgpu-command.cpp:1221`), the same double
wait #953 removes, and it maps a whole 16 MiB page (`wgpu-buffer.cpp:168`). So the author's
dedicated buffer may suit WebGPU better. Memo: `/workspace/inbox/a2a-1793260336336-6cz1l5/triage-rhi-956.md`.

**Resume on:** an author PR naming #956; a maintainer comment (dedicated buffer vs shared heap,
tied to the #869 decision); triager re-check t-9540e9 (11-05 09:00Z, one-shot, the triager's task).
