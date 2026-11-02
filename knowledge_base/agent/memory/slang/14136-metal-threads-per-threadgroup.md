---
type: chain
title: slang#14136 — Metal [[threads_per_threadgroup]] / CUDA blockDim: no way to read the dispatched group size
description: Human-filed (albertrodriguezclo) feature request 2026-11-01 14:29:22Z, cloth-sim porting batch, sibling of #14034. Triaged feature/P2 and reproduced 11-01; PARKED on maintainer API direction (A/B/C) under R6 (hold to 2026-11-05 14:29:22Z); re-check t-c5502a 11-05 14:30Z.
tags: [cuda, metal, system-values, feature-request, r6]
---

# slang#14136 — dispatched threadgroup size on Metal/CUDA

**Ask.** `WorkgroupSize()` folds to the `[numthreads]` constant; Metal's host-chosen size
(`[[threads_per_threadgroup]]`) and CUDA `blockDim` are unreachable outside `[require(cuda)]`
`cudaBlockDim()`. `SV_GroupSize` is E49999. Expected: an entry-point input/builtin → implicit
`uint3 [[threads_per_threadgroup]]` on Metal, `blockDim` on CUDA, fold to `[numthreads]` elsewhere.
Same shape as [#14034](14034-workgroupcount-cuda-metal.md) (entry-point-attribute-only value on Metal).

**GitHub (11-01 14:3xZ).** 0 comments, no labels, no Type. **R6:** no `bot-ok`, no crash word →
hold until **2026-11-05 14:29:22Z** (comments, PRs and commits naming #14136).

**Triage (slang-triager, 11-01 14:39Z, master 6815ed82d). These are the triager's findings; I did not reproduce them.**
Metal/CUDA emit the `256U` constant. `SV_GroupSize` gives E49999 on every target. On Metal a `__target_switch` +
`__intrinsic_asm` emits a call (invalid MSL), so there is **no Metal workaround**; CUDA has `cudaBlockDim()`. On the L40S, a
`[numthreads(256)]` kernel launched with 128-thread blocks gives `WorkgroupSize().x=256` but `blockDim.x=128`, and the
reporter's `blockSum` silently sums half its input. CUDA is already inconsistent: `SV_DispatchThreadID`/`SV_GroupIndex`/
`WaveGetWaveIndex` use the launch `blockDim`, while `WorkgroupSize()`/`WaveGetNumWaves` use the constant
(`slang-ir-legalize-varying-params.cpp:2442-2463`).
**Options:** **A (rec., ~25 LOC)** is a new opt-in getter on an internal SV (#13920 pattern): Metal → `[[threads_per_threadgroup]]`,
CUDA → the existing `blockDimGlobalParam` (`.cpp:2419`), else `uint3(WorkgroupSize())`. **B** is a user `SV_GroupSize` semantic and
can follow A. **C** makes `WorkgroupSize()` dynamic (behaviour change; `tests/bugs/gh-4504.slang` relies on the fold).
**vs #14034:** same 4 edit sites, so the PRs should be separate and stacked: #14034 first (no API decision), then #14136 on top.
Related: #14135 (`__launch_bounds__`), which does not conflict.
**GitHub:** Type=Feature + `reproduced` set, 0 comments. Memo: `/workspace/inbox/a2a-1793543949181-yzx5lj/triage-14136.md`; held draft comment: `/workspace/inbox/a2a-1793543954749-o0o12z/comment-14136.md`.

**Next.** A maintainer picks A/B/C, the name, and `uint3` or `int3`. The triager's one-shot `t-c5502a` runs 11-05 14:30Z:
if nothing has changed, re-verify and post the draft. No fixer until direction arrives (and after #14034, if both proceed).
Owner: slang-triager, thread `gh-issue-shader-slang/slang-14136`.
Host-side companion: [slang-rhi#961](slang-rhi-961-dispatch-time-threadgroup-size.md) (choose the dispatched size; filed 11-01 19:28Z).
