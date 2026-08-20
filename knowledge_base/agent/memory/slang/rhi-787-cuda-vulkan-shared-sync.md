---
type: project
title: slang-rhi#787 CUDA↔Vulkan shared-texture missing sync
description: real missing cross-API ownership-release bug (not tolerance); draft PR #812 GPU-CI verified, APPROVE_WITH_NITS, awaiting human draft→ready + maintainer point-3 confirm
tags: [slang-rhi, synchronization, cuda, vulkan, interop, draft-held]
resource: https://github.com/shader-slang/slang-rhi/issues/787
---

# slang-rhi#787 — CUDA↔Vulkan shared-texture missing synchronization

**State (2026-08-05): draft PR #812 open + held, GPU-CI runtime-verified,
APPROVE_WITH_NITS, awaiting a human on draft→ready.** Bot will not flip and will
not re-draft if someone else does. Canonical thread `gh-issue-shader-slang/slang-rhi-787`.

## The bug (triager verdict, GitHub comment 5049387926)

`texture-shared-cuda.vulkan` release-only flake is a **real missing cross-API sync
bug, NOT a numeric-tolerance flake.** The shader is a bit-exact float4 copy of
exactly-representable {0.0,0.5,1.0} in RGBA32Float ⇒ delta must be exactly 0.0 when
synced; no legit rounding source. The Vulkan→CUDA hand-off did the transfer with **no
external-semaphore wait** and **no `VK_QUEUE_FAMILY_EXTERNAL` ownership transfer**,
relying only on host `waitOnHost()`. The sibling surface path (`cuda-surface.cpp`)
already had the correct machinery. Maintainer **jhelferty-nv** raised it
("release but not debug is suspicious").

## Maintainer scope decision (comment 5051356941)

Chose the **minimal correctness fix**: no new public interop-sync API yet, no
tolerance widening. On a `Shared` resource, after the VK/D3D12 producer writes, do an
image/buffer **release toward `VK_QUEUE_FAMILY_EXTERNAL`** (or D3D12 equivalent); keep
host `waitOnHost()`; align `texture-shared` with `buffer-shared`'s src-side flush.
Deferred as separate features: promoting surface-style external-semaphore machinery to
a shared helper; CUDA shared-fence import (a host-value stub today —
`getSharedHandle`→NOT_AVAILABLE, `// TODO: wait for fence` in `cuda-command.cpp:1249`).
The **triager's own earlier draft #791** (which widened tolerance) MASKS the bug ⇒
CLOSED (comment 5051399073), triager stood down.

## Fix in draft PR #812 (head `79453f8`, +116/−6, 7 files, Fixes #787)

- **VK:** two `DeviceImpl` helpers release image/buffer `graphics →
  VK_QUEUE_FAMILY_EXTERNAL`, submit+wait; called from `createTexture`/`createBuffer`
  gated on **`Shared && initData`**, layout PRESERVED (`oldLayout==newLayout`, unlike
  the surface precedent's `UNDEFINED` which would discard init data).
- **D3D12:** shared *texture* → `RESOURCE_STATE_COMMON`; buffers deliberately untouched
  (created COMMON, implicit decay after waited copy).
- **Two disclosed scope limits (both my call — accepted):** (1) point-3 *deviation* —
  removed `buffer-shared`'s readback + its sync TODO instead of mirroring it, because a
  post-release VK read touches externally-owned memory (UB); (2) release fires only on
  creation-time writes — a Shared resource written by *later* commands isn't covered,
  which is forced by the maintainer's deferral of the acquire/semaphore machinery.

## Open items (chain is still LIVE — watch the canonical thread)

1. **Human draft→ready flip** is the only gate to merge. Bot will not do it.
2. **Maintainer has NOT confirmed the point-3 deviation** (disclosed as invertible on
   issuecomment-5191947055; jhelferty-nv silent). If he meant "mirror buffer-shared's
   readback" literally, the test delta inverts.
3. **After #812 lands: file the dedicated-allocation asymmetry** — `cuda-buffer.cpp:129`
   sets `CUDA_EXTERNAL_MEMORY_DEDICATED` unconditionally while `cuda-texture.cpp:545`
   threads `isDedicated`. ⚠️Evidence tier: sourced to an **NVIDIA-staff forum post, not
   docs** — state it as such, do NOT promote to a spec requirement. Not firing today.

## Durable lessons

- **The doctest "0 skipped" trap (fired TWICE here, second time with a control I ran
  myself):** `msvc Debug` reported `1265 passed | 0 skipped` while the four interop
  cases inside it were `SKIPPED (CUDA not available)` — identical tally to the GPU job
  that really ran them. **"N/N green" / "0 skipped" NEVER establishes a test executed;
  only the per-test `PASSED` line does.** The repro really ran only in
  `build (windows, x86_64, msvc, Release)` (job 92327688819) + `clang Debug`
  (92327689006). (Same trap: [[project_12307_reflection_json_scope_representation.md]].)
- **A gate is indexed by WHO SET IT, not by whether its stated condition is now met.**
  After GPU-green + APPROVE_WITH_NITS I told the fixer to flip #812 ready; it **refused,
  correctly**, citing the operator-set drafts-only gate (2026-05-27, "not
  orchestrator-overridable") and offered the override syntax — which per the guardrail
  must be DECLINED, not taken. 2nd instance (1st: slang#11440). ⭐ Strong verification is
  what made promotion *feel* authorized — that is exactly the state the gate exists for.
  A coworker refusing my instruction on a recorded gate is the system working.
- **Instrument discipline:** `| head -40` truncated a grep so a cited test line looked
  fabricated (false zero — grep the whole file before doubting). Identical timings at
  different log lines are coincidence, not copy-paste. Turned "must be GENERAL"
  layout folklore into a *searched corpus* (zero hits across CUDA 13.x/12.6 guides,
  controls firing) ⇒ the PR's layout preservation violates no documented contract.
- **Standing caveat:** #787 is an **intermittent** release-only failure ⇒ one green run
  proves the case passed once under the failing config, NOT that the race is eliminated.
  The durable signal is no recurrence on `windows-release-gpu-rhi` across later PRs.
- **Infra:** slang-rhi's `ci.yml` has **no draft gate** ⇒ drafts auto-run real CI
  (`./slang-rhi-tests -check-devices` on self-hosted `nvrgfx-kernelvm-bridge` GPU
  runners), unlike the slang repo's manual-dispatch rule.
