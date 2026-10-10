---
type: project
title: slang-rhi#787 CUDA↔Vulkan shared-texture missing sync
description: Real missing cross-API ownership bug (not tolerance). jhelferty-nv mandated their own explicit API (handOffShared/takeOverShared on ICommandEncoder), implemented in PR #881. jhelferty flipped it READY on 2026-09-28. Final head 775f522 is GPU-CI-green and per-test re-verified. NOT merge-ready — reviewer REQUEST_CHANGES on R4/R5 pending jhelferty's answer to 5907630393, plus skallweitNV's review. Review rounds and the ready/re-chase log are in [[rhi-787-review-history.md]].
tags: [slang-rhi, synchronization, cuda, vulkan, interop, live-chain]
resource: https://github.com/shader-slang/slang-rhi/issues/787
---

# slang-rhi#787: CUDA↔Vulkan shared-texture missing synchronization

**State (2026-10-07): LIVE, parked on human review.** PR #881 is non-draft at head `775f522` (GPU-CI-green,
per-test re-verified by me), but it is **not merge-ready**. It is parked on two inputs:
- **(A)** jhelferty's answer to scope question [5907630393](https://github.com/shader-slang/slang-rhi/pull/881#issuecomment-5907630393)
  (09-30 08:48Z, silent 7+ days). Until then the reviewer verdict is REQUEST_CHANGES on R4/R5:
  - **R4:** AS/micromap build-input buffers aren't validated as uses. Spec 5798248018 line 31 counts "AS/micromap
    ops on the buffer" as uses, but only scratch buffers are checked.
  - **R5:** the same-device operand precondition (spec line 11) isn't validated.
  - The PR body lists both as "Known partials".
- **(B)** skallweitNV's review. jhelferty-nv assigned them on 10-06 21:21Z and removed dshreiner-nv. They're active in
  the repo but haven't reviewed.
- **Operator question (dashboard msg 15, 10-07):** 1 = slang-fixer posts one GitHub reminder, 2 = operator pings
  out-of-band, 3 = wait. Nothing has been posted. Re-chase `rhi-881-review-rechase-755a` (2026-10-11 09:00Z) checks
  the dashboard for the answer before acting.

Canonical thread `gh-issue-shader-slang/slang-rhi-787`; PR review thread `gh-pr-slang-rhi-881-review`. The chain
re-opens on jhelferty's webhook. #812 (the register-all alternative) was CLOSED by jhelferty-nv on 2026-09-28, so it
is no longer an open question.

## The bug (triager verdict, comment 5049387926)

`texture-shared-cuda.vulkan` is a release-only flake caused by a **real missing cross-API sync bug, not numeric
tolerance**. The shader is a bit-exact float4 copy of exactly-representable values, so the delta must be 0.0 when
synced. The Vulkan→CUDA hand-off had **no external-semaphore wait** and **no `VK_QUEUE_FAMILY_EXTERNAL` ownership
transfer**, only host `waitOnHost()`. Shared images stay `VK_SHARING_MODE_EXCLUSIVE` on the graphics queue, so CUDA
reads an image Vulkan still owns. `cuda-surface.cpp` already had the correct machinery, and D3D12 already works.
The earlier draft #791 widened the tolerance, which MASKED the bug, and was closed.

## Policy (comment 5704482839)

jhelferty rejected #812's create-time release ("makes Vulkan and D3D12 mean different things"):
- **Same contract on VK and D3D12.** Another API accesses a shared resource only after the producer's `waitOnHost()`
  or a shared `IFence` wait. **Ping-pong is required.**
- **Vulkan** releases to EXTERNAL and acquires back at use time, not at create. **D3D12** behavior is unchanged.
- Document the contract next to the `Shared` flags / `FenceDesc::isShared` in `include/slang-rhi.h`.
- **Tests:** don't change `texture-shared-cuda`; extend `buffer-shared-cuda` to a real ping-pong.
- Out of scope: `createFenceFromSharedHandle` for CUDA.

## ⭐ Decisive spec (comment 5798248018): implement jhelferty's own API, add nothing

"Please implement this. **Do not invent another API.**" NO `IExternalMemoryQueue`, NO `SubmitDesc` extension, NO new
queue types, NO shared-fence CUDA import.
- **API:** append to the `ICommandEncoder` tail, keeping the GUID `0x8ee39d55…`:
  - `handOffShared(uint32_t resourceCount, IResource* const* resources, ICommandQueue* destQueue)`
  - `takeOverShared(uint32_t resourceCount, IResource* const* resources, ICommandQueue* srcQueue)`
  - `ICommandEncoder` is rhi-produced, not client-implementable, so a tail-append is ABI-safe and `pr: non-breaking`.
    That contract is documented in the interface doc.
- **Semantics:** each op records on THIS encoder only. There's no submit, wait or host-wait inside. The order is:
  producer `handOffShared` + submit → `waitOnHost()` → next owner `takeOverShared` before first use.
- **Backends:** on Vulkan, handOff = QFOT release thisFamily→EXTERNAL and takeOver = acquire EXTERNAL→thisFamily.
  Every other backend is a no-op.
- **Architecture:** record-then-replay. A new `SLANG_RHI_COMMANDS` X-macro command gets a `cmd*` handler in all
  7 recorders (Vulkan real, 6 no-op), which is why the diff touches every backend.
- **Debug layer:** a process-global table keyed by `getSharedHandle`'s `NativeHandle`, with states Unowned →
  Owned(Q) → HandedOff(Q,R) → Owned(R).
  - Severity: API misuse is an error on every backend; use of a resource that is merely other-owned, or whose owner
    can't be told, is a warning.
  - The recycled-handle hazard is closed by reset-at-creation plus resolving shared-ness fresh from the resource's
    own flag.

## Verified at `775f522` (09-30)

clang Debug job 109042934512 + msvc Release 109042934457: 28 success / 9 skipped / 0 fail.
`buffer-shared-cuda.vulkan` + `texture-shared-cuda.vulkan` PASSED on both, `ray-tracing-triangle-intersection.vulkan`
PASSED, `does not currently own` = 0, FATAL/crash = 0.

## Open items

1. jhelferty's answer on R4/R5 (5907630393) and skallweitNV's review.
2. **After the fix lands:** file the dedicated-allocation asymmetry. `cuda-buffer.cpp:129` sets
   `CUDA_EXTERNAL_MEMORY_DEDICATED` unconditionally, while `cuda-texture.cpp:545` threads `isDedicated`. ⚠️ The
   evidence is an NVIDIA-staff forum post, not docs, so state it as such. It isn't firing today.
3. At merge or close, okf-synthesis condenses this file to a terminal record.

## Durable lessons

- **The doctest "0 skipped" trap (fired twice here).** `msvc Debug` reported `1265 passed | 0 skipped` while its four
  interop cases were `SKIPPED (CUDA not available)`. "N/N green" never establishes that a test executed; only the
  per-test `PASSED` line does. Read the *self-hosted* GPU jobs (msvc Release + clang Debug), not the GitHub-hosted
  msvc Debug job. (Same trap: [[project_12307_reflection_json_scope_representation.md]].)
- **A gate is indexed by WHO SET IT,** not by whether its stated condition is now met. The fixer correctly refused my
  flip instruction on the operator's drafts-only gate. In the end the maintainer flipped #881 themself.
- **A coworker's descope of a maintainer requirement isn't a deferral until the maintainer agrees.** I relayed
  "P1/P2 descoped" (R4/R5) as settled without checking.
- **Correctness asymmetry:** resolve uncertainty toward acquiring, never toward skipping. Skipping a resource that is
  accessed reintroduces the bug, while a redundant barrier only costs time.
- **Instrument discipline:** `gh api .../logs` returns 0 bytes without `--allow-escape-sequences` (then strip
  `\x1b[...m`). `| head -40` once truncated a grep so a cited test line looked fabricated.
- **Intermittent bug:** one green run proves only that the case passed once. The durable signal is no recurrence on
  `windows-release-gpu-rhi` across later PRs. slang-rhi's `ci.yml` has **no draft gate**, so drafts auto-run GPU CI.
