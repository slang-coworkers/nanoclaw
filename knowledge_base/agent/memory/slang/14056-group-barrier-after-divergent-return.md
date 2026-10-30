---
type: chain
title: slang#14056 — no diagnostic for a group barrier reachable after a thread-dependent `return`
description: Human-filed (albertrodriguezclo) feature request 2026-10-29 21:51:31Z, cloth-sim batch. Triaged Feature/medium/P2 (IR uniformity validation) by slang-triager 10-29 22:12Z. Parked on maintainer direction (csyonghe / skiminki-nv); R6 hold, one-shot post t-01c222 2026-11-02 21:55Z.
tags: [uniformity, barrier, spirv, metal, wgsl, diagnostics, feature-request, parked, r6]
resource: /workspace/inbox/a2a-1793311950097-rc2rct/triage-14056.md
---

# slang#14056 — group barrier after a divergent `return`

**Ask.** Warn when GroupMemoryBarrierWithGroupSync / AllMemoryBarrierWithGroupSync /
DeviceMemoryBarrierWithGroupSync is reachable after a thread-dependent early `return`. This is UB on
SPIR-V (`OpControlBarrier` needs uniform control flow) and Metal, and WGSL rejects it (Tint/Naga uniformity).
CUDA tolerates it. The reporter points to the existing uniformity pass, #13977.

**Triage (slang-triager, 10-29 22:12Z, Debug build on master 977df1246). These are the triager's findings; I did not reproduce them.**
- The kernel is silent on every target, including with `-validate-uniformity`, and spirv-val passes.
  **Tint rejects** the WGSL (`workgroupBarrier must only be called from uniform control flow`). **Naga accepts it**, because naga has no barrier-uniformity check, so the issue's "Tint/Naga" is half right.
  On the L40S, vk and cuda finish without hanging, and the non-loader threads read a stale shared slot. That run is UB, so it is information only.
- **#13977 is an open PR by CrossVR that fixes a parameter-index bug in `slang-ir-uniformity.cpp`; it adds no barrier work.**
  The pass (#3704) is opt-in and checks data flow only (E41201/E41203). Its control dependence is dominator-based and approximate, the IR has no post-dominator tree, and there is no existing barrier diagnostic.
- **False-positive model:** treat SV_GroupID and cbuffer values as uniform (the pass currently seeds every SV input as non-uniform), use precise control dependence, and make the check interprocedural.
  Tint ground truth on 7 kernels: 4 accepted and 3 rejected.
- Options: **A** a barrier check inside opt-in `-validate-uniformity` (recommended first); **B** default-on warning; **C** a narrow default-on lint; **D** docs only.
  Open questions: opt-in or default-on? Does CUDA warn? Group barriers only, or also wave barriers and derivatives?
- Side finding, not acted on: the `float*` parameter on `-target wgsl` emits invalid `ptr<, f32>` with exit code 0. #13399 already tracks it.

**GitHub state (verified 10-29 22:1xZ).** Issue Type=Feature and the `reproduced` label were set by the bot. 0 comments, R6 hold until 2026-11-02T21:51:31Z.

**Next.** The triager's one-shot `t-01c222` runs 11-02 21:55Z. Its task session `sess-1793311883249-5dzcw5` exists (verified).
It posts the parked 5-bullet (draft `drafts/comment-14056.md` in the triager's workspace), or a delta if a human has replied.
No fixer handoff until csyonghe or skiminki-nv gives direction.
Owner: slang-triager `sess-1793310873716-vp23c7`, thread `gh-issue-shader-slang/slang-14056`. Memo: see `resource`.
