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
- **Draft PR [#1263](https://github.com/shader-slang/slangpy/pull/1263)** "Raise an error for half gradients on devices without fp16 atomic add", head `fix/issue-1262`,
  closes #1262 (checked). pr-mapping → slangpy-fixer `sess-1793845564130-hdm9p6` (checked). In review as of 03:51Z.
- **#1263 R1 (04:14Z): REQUEST_CHANGES @`9c77154b`.** The verdict went to the fixer. B1: direct-bound parameter structs (`generator.py:303-305` does not recurse)
  skip the atomic_half check, so a `DiffTensor<half>` struct field still fails in native dispatch on Vulkan. That is the common half-weights case. Plus 3 gaps and 2 questions.
  The reviewer found the approach sound, with 2774 passed in the full suite and CI green. Memo: [raw/slangpy-1263-r1-review.md](raw/slangpy-1263-r1-review.md).
  Side note: Slang's built-in `RWByteAddressBuffer.InterlockedAddF16Emulated` works on the L40S Vulkan, which is relevant to option (2), the CAS fallback.
- **[Triage Resolution] (04:55Z):** fixed in draft #1263 @`cc59e654` (5 files +260/−11). R1 B1 (direct-bound struct fields) is fixed; R2 APPROVE_WITH_NITS, nit applied.
  The gate is `Feature.atomic_half` OR `SPV_EXT_shader_atomic_float16_add` (slang-rhi never reports atomic_half on Vulkan); the triager posted correction 6649111851.
  **Behaviour change:** load_once-only half DiffTensor bwds used to work and is now rejected (PR Risk line). The maintainer chooses a restore-gradients follow-up (B CAS / C slang-rhi / D `InterlockedAddF16Emulated`).
  Gaps: explicit `AtomicTensor<half>.add` still crashes; half2 on non-NVIDIA Vulkan is unverified; custom struct differentials are unchecked. **READY-FLIP PENDING (weekly list).**
- **diff_pair `_result` abort (04:55Z):** `f.bwds(diff_pair(torch_t,g), …, _result=diff_pair(y,gy))` aborts on CUDA (`cuda-command.cpp:946`) even with float, on main.
  Two agents reproduced it (triager + reviewer). Filing policy applies, so I told the triager to dedupe and file, with no fixer yet.
