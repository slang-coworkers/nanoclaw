---
type: project
title: slang-rhi#787 CUDA↔Vulkan shared-texture missing sync
description: texture-shared-cuda.vulkan flake — real missing cross-API sync, NOT tolerance; reverses draft PR #791
tags: [slang-rhi, synchronization, cuda, vulkan, interop, ready-for-fix]
resource: https://github.com/shader-slang/slang-rhi/issues/787
---

# slang-rhi#787 — CUDA↔Vulkan shared-texture missing synchronization

**State (2026-07-22):** ready-for-fix, HELD pending maintainer scope confirmation. Not dispatched to slang-fixer.

Maintainer **jhelferty-nv** mentioned @nv-slang-bot on issue #787 (comment 5049057957):
asked whether the flake is a symptom of missing synchronization — "release but not debug is suspicious."

## Triager verdict (posted GitHub comment 5049387926, HEAD 1afb838)

Maintainer is right: **missing cross-API sync bug, NOT a numeric-tolerance flake.**
- Shader is a bit-exact float4 copy of exactly-representable {0.0,0.5,1.0} in RGBA32Float →
  delta must be exactly 0.0 when synced; no legit ~0.01 rounding source.
- Vulkan→CUDA hand-off does the transfer with **NO external-semaphore wait** and
  **NO VK_QUEUE_FAMILY_EXTERNAL ownership transfer** — relies solely on host-side
  `waitOnHost()` (test-texture-shared.cpp:119).
- Sibling surface path (cuda-surface.cpp) already implements correct machinery
  (exported timeline semaphore imported into CUDA + ownership-transfer barriers).
- test-buffer-shared.cpp:40 has in-tree `// TODO: Implement actual synchronization (and not this hacky solution)`.
- release/debug asymmetry = hypothesis (no CI log in hand; couldn't repro — Windows-only
  same-GPU CUDA↔Vulkan interop, triager env is Linux container w/o matching GPU).

## Suspect path / fix shape
Vulkan→CUDA shared-texture interop hand-off. Fix = export/signal a Vulkan timeline semaphore,
import+wait in CUDA (`cuImportExternalSemaphore` + `cuWaitExternalSemaphoresAsync` — loaded but
unused today) before the CUDA read; plus VK_QUEUE_FAMILY_EXTERNAL ownership-transfer barrier on
the OPTIMAL-tiled shared image; retire the test-buffer-shared TODO at same time.

## Open decisions for maintainer (design calls — why NOT auto-dispatched)
1. **Scope:** RHI-level API fix vs test-only helper.
2. **#791 disposition:** triager's OWN earlier draft PR #791 widened the tolerance —
   on this analysis it MASKS the bug and should be **held/closed, not merged**. Public
   verdict comment already states this.

Both depend on jhelferty-nv's reply, which re-enters as a webhook on the canonical thread
`gh-issue-shader-slang/slang-rhi-787`. Chain rests "handed off — awaiting maintainer."

## Design proposal (2026-07-22, GitHub comment 5050801804, HEAD 1afb838)
jhelferty-nv follow-up (comment 5050641753): "Does RHI not have existing primitives for the
interop? What RHI-level API fix would you propose?" Triager surveyed API surface + answered:

- **Q1 — primitives exist?** Yes. `IFence` is a shareable timeline-valued fence
  (`slang-rhi.h:1640`; `FenceDesc.isShared` + `getSharedHandle`; `SubmitDesc.waitFences/signalFences`).
  **Vulkan + D3D12 implement it end-to-end** (VK exportable timeline semaphore; D3D12 `CreateSharedHandle`).
- **Q2 — proposed fix = two distinct gaps, both essentially CUDA-side:**
  - **(a) sync:** CUDA `IFence` is a host-value stub (`getSharedHandle`→NOT_AVAILABLE, cuda-fence.cpp:38);
    submit has literal `// TODO: wait for fence` (cuda-command.cpp:1249; no `cuWaitExternalSemaphoresAsync`);
    **no public `createFenceFromSharedHandle`** to import a VK-exported fence.
  - **(b) ownership:** generic shared-texture path does no `VK_QUEUE_FAMILY_EXTERNAL` transfer;
    RHI exposes no API for it.
  - **Proposed shape:** reuse `IFence`/`SubmitDesc` + add a **versioned/derived** fence-import
    interface (⚠️ appending to fixed-UUID `IDevice` in place is NOT ABI-safe) + wire CUDA's
    `cuWait/SignalExternalSemaphoresAsync` + decide how ownership transfer is surfaced.
    Offered test-only-helper alternative; **recommended the real versioned API.**

**Held for maintainer scope decision:** asked jhelferty-nv to pick
**(A)** versioned interface + full sync + ownership contract, vs **(B)** test-only helper first,
and how to surface ownership transfer. Not dispatching fixer until he answers (design + public-API
+ ABI call; still overturns #791). #791 stays parked as masking.

## Maintainer scope DECISION (2026-07-22, comment 5051356941) — chain re-routed to fixer
jhelferty-nv chose **minimal correctness fix, NO new public interop-sync API yet, NO tolerance widening.**
Directive (verbatim intent):
1. After VK/D3D12 producer writes, do an image/buffer **release toward `VK_QUEUE_FAMILY_EXTERNAL`**
   (or D3D12 equivalent) when `TextureUsage::Shared` / `BufferUsage::Shared`.
2. Keep host `waitOnHost()` (or make `createTexture` wait after init upload).
3. Align `texture-shared` with the intended `buffer-shared` src-side flush before CUDA read.

**Deferred as SEPARATE scoped features (NOT this fix):** promoting surface-style external-semaphore
machinery to a shared RHI helper; CUDA shared-fence import (docs/api.md marks it unavailable).

**Routing:** implementation dispatched to **slang-fixer** (drafts-only; Fixes #787;
report_pr_created; post 5-bullet on issue since draft won't auto-close). **slang-triager** to
**close #791** with explanatory comment (maintainer-authorized via direct bot mention; tolerance
masks the real bug). Chain state: **fixer owns implementation**; triager stands down after #791 close.

## #791 CLOSED (2026-07-22, PR comment 5051399073) — triager stood down
Triager posted explanatory close comment (tolerance masks the real ownership-transfer bug,
superseded by maintainer-scoped fix), verified state=CLOSED, confirmed branch fix/issue-787 was theirs.

## Fixer implementation (2026-07-22, msg 30) — BUILDING, PR pending
Worktree `wt-slang-rhi-787-sync`, branch `fix/issue-787-sync`, off fresh origin/main (1afb838).
Plan passed codex PLAN_REVIEW (2 rounds, 4 must-fixes). **+106/−6 across 5 src + 2 tests:**
- **VK:** queue-family ownership release (`m_queueFamilyIndex → VK_QUEUE_FAMILY_EXTERNAL`) on
  Shared image/buffer right after init-data upload in `createTexture`/`createBuffer`, submitted+waited
  on same VkQueue; gated on `initData` (don't release uninitialized Shared resource prematurely).
- **D3D12:** transition Shared texture to COMMON after upload (device-local buffer already COMMON
  post-waited-copy — no change).
- **Tests:** fixed misleading comment in test-texture-shared.cpp; retired invalid readback+TODO hack
  in test-buffer-shared.cpp — both now rely on real release+wait (maintainer point 3).
- **Verification gap (stated upfront):** D3D12 doesn't compile on Linux container; Windows-only
  same-GPU CUDA↔Vulkan interop test can't run here. Local build validates VK hunk only; release
  correctness rests on VK external-memory spec + in-tree surface-path precedent (cuda-surface.cpp);
  D3D12 hunk hand-reviewed + relies on PR Windows CI.
- **Next (fixer):** green build → commit, open draft PR (Fixes #787), report_pr_created, post 5-bullet
  on #787, dispatch slang-reviewer. Full [Fix Report] to follow. **I drive PR from here.**
