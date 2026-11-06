---
type: chain
title: slang-rhi#956 — WebGPU readBuffer allocates a staging buffer per call
description: HELD on maintainer jkwak-work (self-assigned + Q4 2026 milestone 11-04). Bot stands down; no timer. #953 merged 10-29. Resume only on a webhook (author PR naming #956, or a maintainer ask). Couples to Vulkan sibling #862 / our draft #869.
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

**11-05 re-check t-9540e9 (triager [Report]; verified live by me 11-05):** still open, 1 comment
(ours, unedited since 10-29). Human triage: 11-02 jhelferty-nv set Type=Performance + `enhancement`
and assigned jvepsalainen-nv. 11-04 17:05Z jkwak-work unassigned jvepsalainen-nv, self-assigned,
milestoned "Q4 2026 (Fall)". #953 MERGED 10-29 09:16Z, so our "land #953 first" ordering is moot.
No reuse PR from j8asic yet. #869/#862 slot-vs-heap decision still open.
**Decision:** maintainer-owned (rung 4 hold). Bot stands down, no fixer, no new re-check (webhooks
deliver an author PR or a maintainer mention). Authorized the triager's one silent in-place edit of
cmt 6491098268: #953 merged, so a reuse PR builds on `main` (rhi default branch; not master); the issue now sits with the assignee. Edit live 11-05 09:06:07Z, verified. Chain CLOSED for the bot.

