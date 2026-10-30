---
type: chain
title: slang#14029 — CUDA grid-wide sync intrinsic + cooperative-launch reflection
description: Human-filed (albertrodriguezclo, CONTRIBUTOR) feature request 2026-10-29 16:18Z, part of the reporter's cloth-sim batch #14026–#14031. Triaged P2 by slang-triager. Parked on maintainer design direction; R6 4-day no-comment window, re-check t-6f4b45 2026-11-02 16:30Z.
tags: [cuda, capabilities, reflection, feature-request, parked]
---

# slang#14029 — CUDA `this_grid().sync()` + cooperative-launch reflection

**Ask.** (1) A public CUDA-only grid-sync intrinsic behind a new `cuda_cooperative_launch` atom;
(2) entry-point reflection that the kernel needs `cuLaunchCooperativeKernel`, plus an optional
`[CooperativeLaunch]` attribute; (3) a slang-rhi dispatch path (separate repo, out of scope).

**Triage (slang-triager, 10-29 16:30Z, master 9b3ac252d).** None of the three exists. The CUDA
"device" barriers (`hlsl.meta.slang:10630`) emit `__syncthreads()`, which syncs only the block.
The reporter's internal-intrinsic workaround reproduces: `-target cuda` compiles with nvcc 12.6, and
spirv/metal/hlsl give E36107. **Triager's new finding:** `-target ptx` fails on NVRTC 12.6, because
the prelude typedefs `intptr_t`/`uintptr_t` (`slang-cuda-prelude.h:291/297`) clash with CCCL types
pulled in by `<cooperative_groups.h>`. An NVRTC A/B run with the typedefs aligned compiles. This is
not verified by me.

**Recommended (triager):** core intrinsic (I-A) + prelude fix + reflection from
`inferredCapabilityRequirements` (R-A, the same path as `[Shader64BitIndexing]`), with the attribute optional.

**Decisions for the maintainer:** accept the feature?; name; reflection channel R-A vs R-B
(post-emit `I…Metadata`); attribute none/optional/required; prelude fix as a separate PR?

**GitHub state.** Issue Type set to Feature by the bot (verified 10-29). 0 comments: R6 holds a
bot comment on a new human issue for 4 days. No fixer dispatched.

**Next.** Re-check `t-6f4b45` (triager's group) 2026-11-02 16:30Z. On maintainer direction → slang-fixer;
on a reporter PR → validate it, no competing work; on silence → post the parked 5-bullet. Owner:
slang-triager, thread `gh-issue-shader-slang/slang-14029`. Memo: the triager's `memory/issues/triage-14029.md`.
