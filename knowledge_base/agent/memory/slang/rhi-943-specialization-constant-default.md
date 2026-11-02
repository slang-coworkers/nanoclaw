---
type: chain
title: slang-rhi#943 — [SpecializationConstant] reads 0 instead of its default on D3D11/D3D12/CUDA/CPU
description: Confirmed bug (not a regression), triaged by slang-triager; parked on a maintainer direction pick (options 1 / 1b / 2). Assignee jkwak-work since 10-26. Triager one-shot t-7aa5f5 re-checks 2026-11-08T13:00Z.
tags: [slang-rhi, specialization-constant, parked, awaiting-maintainer]
---

# slang-rhi#943 — specialization constant default reads 0

**State (verified 2026-11-01 13:05Z via `gh`).** OPEN; assignee `jkwak-work` (self-assigned 10-26, no
comment), milestone "Q4 2026 (Fall)". The last comment is the bot's triage comment
[6397947256](https://github.com/shader-slang/slang-rhi/issues/943#issuecomment-6397947256) (posted 10-25,
edited in place 11-01 13:01Z). Linked slang-rhi#942 MERGED 2026-10-29 10:54Z; its tests stay at
`Vulkan | Metal | WGPU` because of this issue.

**Direction options (no pick yet).** 1 = host writes the default; 1b = 1 plus a Slang reflection signal;
2 = Slang folds the default. Option 2/1b would show up as a shader-slang/slang PR by jkwak-work.

**Ownership.** The reporter (albertrodriguezclo) or the assignee implements. No slang-fixer dispatch
unless someone asks the bot.

**Timer.** Triager one-shot `t-7aa5f5` fires 2026-11-08T13:00Z (in the triager's group, so
`ncl tasks list` from Main does not show it). Register entry: `gh-issue-shader-slang/slang-rhi-943`
in `memory/supervisor-state.json` (`awaiting_human`).
