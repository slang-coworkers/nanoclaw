---
type: chain
title: slang#14410 — HLSL/CUDA Atomic<half|double>.compareExchange emits overloads DXC/NVRTC reject
description: Bot-filed 2026-11-08 10:19:47Z by the #14408 slang-triager mid-triage (label reproduced, no assignee). Owned by the #14408 chain; no separate dispatch.
tags: [hlsl, cuda, atomics, half, double, compare-exchange]
---

# slang#14410 — HLSL/CUDA half/double `compareExchange`

**Ask.** HLSL emits plain `InterlockedCompareExchange` for `half`/`double` (DXC: no matching
overload; only 32-bit `float` gets `InterlockedCompareExchangeFloatBitwise`,
`slang-emit-hlsl.cpp:779-796`). CUDA emits `atomicCAS(double*|__half*, …)` (NVRTC: no overload;
prelude has `float` only, `slang-cuda-prelude.h:3030-3037`). Expected: CUDA bitwise CAS via pointer
cast (`unsigned long long` for double, `unsigned short` sm_70+ for half); HLSL a diagnostic.

**Owner.** Side finding of the [#14408](14408-spirv-glsl-float-atomic-cas.md) triage — filed by
slang-triager session `sess-1794132561423-uz9kum` (thread `gh-issue-shader-slang/slang-14408`).
Fix routing (bundle with #14408 or separate fixer) comes from that triage report, which lands in
Main webhook session `sess-1794132463758-thhk08`. Do **not** mint a triager/fixer on
`gh-issue-shader-slang/slang-14410` unless that report says to.

**2026-11-08 webhook (Main `sess-1794133189197-omfj1j`).** Pre-checks: no memory hit for 14410,
events = bot labeled/typed only, 0 comments, no assignee, no coworker session on the 14410 thread.
Not dispatched.
