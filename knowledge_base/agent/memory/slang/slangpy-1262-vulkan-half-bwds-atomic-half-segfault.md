---
type: chain
title: slangpy#1262 — Vulkan backward pass through a half input crashes when the device lacks atomic_half
description: Bot-filed 2026-11-05 02:22Z by slangpy-triager. Side-find from slangpy-reviewer's R1 on PR #1261 (#1260 chain). DiffTensor<half> grads use InterlockedAddF16 with no Feature.atomic_half check, so Vulkan crashes with SIGSEGV/SIGILL. Fixer dispatched via the triager handoff 11-05.
tags: [slangpy, vulkan, autodiff, half, atomics, side-find]
---

# slangpy#1262 — half-input bwds crash on Vulkan without atomic_half

- **Origin:** slangpy-reviewer's R1 on [PR #1261](slangpy-1260-torch-bfloat16-dtype.md) saw a half→half autograd segfault on main. I sent it
  to the #1260 slangpy-triager session (`…6y7ocu`) 02:13Z, and it reproduced, deduped and filed it 02:22Z (checked: OPEN, author nv-slang-bot, no labels,
  no @-mentions, no closing links).
- **The triager's finding:** on Vulkan, any `[Differentiable]` function with a half input that needs a gradient crashes at the bwds dispatch, on both bridges and also with
  plain `spy.Tensor`. `DiffTensor<half>` accumulates through `InterlockedAddF16` (`slangpy/slang/atomics.slang:62-69`). The L40S Vulkan device has no
  `Feature.atomic_half`, and SlangPy never checks for it. The reviewer's "float f(half) works" control and "CUDA grad None" did NOT reproduce.
  Options: (1) an atomic_half check that raises [smallest], (2) a CAS fallback, (3) slang-rhi capability validation.
- **Unfiled side note (unverified):** explicit `fn.bwds(diff_pair(...), _result=diff_pair(...))` misbehaves even for float. It may be unsupported usage.
- **Decision 02:25Z:** start a fixer chain (fixer load is light: one slangpy-fixer session running). The triager hands off to slangpy-fixer on
  `gh-issue-shader-slang/slangpy-1262`. The fixer picks the option; the triager suggested (1) as the smallest. **The `issue_opened` webhook for #1262 needs NO dispatch.**
- **Triage (02:26Z):** bug/high (process crash)/P2. Recommended (1): an atomic_half check in `slangpy/builtin/tensorcommon.py` (`gen_calldata` :373, `resolve_types` :163),
  firing only on atomic grad accumulation. Handed to slangpy-fixer on `gh-issue-shader-slang/slangpy-1262`, based on main and independent of #1261.
  Triage comment 6647994640 (checked).
