---
type: chain
title: slang#14029 — CUDA grid-wide sync intrinsic + cooperative-launch reflection
description: Human-filed (albertrodriguezclo, CONTRIBUTOR) feature request 2026-10-29 16:18Z, part of the reporter's cloth-sim batch #14026–#14031. Triaged P2 by slang-triager. Parked 5-bullet posted 2026-11-02 16:32Z. jhelferty-nv assigned kaizhangNV + label cuda 11-02 18:24Z. Bot chain CLOSED 11-09 (maintainer-owned, no timer); reopens only on a webhook or an operator ask.
tags: [cuda, capabilities, reflection, feature-request, maintainer-owned, closed-for-bot]
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

**GitHub state.** Issue Type set to Feature by the bot (verified 10-29). 0 comments at the time (10-29), held under my since-retired R6 4-day rule. No fixer dispatched.

**Next (superseded 11-02, see below).** Re-check `t-6f4b45` (triager's group) 2026-11-02 16:30Z. On maintainer direction → slang-fixer;
on a reporter PR → validate it, no competing work; on silence → post the parked 5-bullet. Owner:
slang-triager, thread `gh-issue-shader-slang/slang-14029`. Memo: the triager's `memory/issues/triage-14029.md`.

**11-02 re-check (t-6f4b45, triager).** No change: 0 human comments, no labels, assignee or milestone, and no PR says
`Fixes #14029`. The triager posted the parked 5-bullet:
[6582487816](https://github.com/shader-slang/slang/issues/14029#issuecomment-6582487816) (nv-slang-bot, 16:32:43Z; I verified it,
and it does not state the stale wait). It lists the 5 decisions and the NVRTC 12.6 finding (prelude lines unchanged on
master 8229f2742). The 10-29 to 11-02 hold came from my stale R6 rule (see Core Memory); the post itself is fine under
no-wait. Next: one-shot `t-dc64ec` 2026-11-09 16:30Z. If nothing has changed then, it posts no new comment and decides
whether to keep the chain parked or close it.

**11-09 re-check (t-dc64ec, triager) — bot chain CLOSED.** jhelferty-nv **assigned kaizhangNV** and added the
`cuda` label 2026-11-02 18:24Z, about 2 h after our post. The `.assigner` is jhelferty-nv; the `.actor` field shows the
assignee, kaizhangNV. I verified this 11-09. There are still 0 human comments, no milestone and no `Fixes #14029` PR.
The triager edited 6582487816 in place (16:32:17Z): it names kaizhangNV as the decision owner (plain name, no @) and
says the fixer handoff happens only if the assignee asks. The NVRTC blocker is unchanged on master ae4e57957a. No new
timer: a maintainer-owned park is not polled. It reopens on a comment, an nv-slang-bot mention, a linked PR or an
operator ask; then route to the triager on `gh-issue-shader-slang/slang-14029`.
