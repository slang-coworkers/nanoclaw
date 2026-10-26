---
type: chain
title: slang#13904 — WGSL ConstantBuffer<T, ScalarDataLayout> emitted stride vs std140 reflection
description: Human-filed (albertrodriguezclo, external) 2026-10-25. Triaged and reproduced by slang-triager; the reporter's own PR #13935 matches the brief and was verified locally at a2ee40c. Parked on human decisions (jkwak-work capability gate, PR review); nothing dispatched to slang-fixer. Overlaps bot draft #13402 by one line.
tags: [wgsl, layout, reflection, community-pr, parked]
---

# slang#13904 — WGSL `ConstantBuffer<T, ScalarDataLayout>` layout mismatch

**Bug.** Reflection always uses std140 for WGSL CBs (`WGSLLayoutRulesFamilyImpl::getConstantBufferRules`,
`slang-type-layout.cpp:2896`). IR lowering maps the explicit Scalar layout to Natural
(`slang-ir-lower-buffer-element-type.cpp:2571-2588`). In the repro, the emitted shader reads `b` at byte 16
and reflection says byte 64.

**Chain.**
- 2026-10-25 07:15Z `issue_opened`: routed to slang-triager on `gh-issue-shader-slang/slang-13904`.
  Triager session `sess-1792912620450-r3ob9i`.
- 07:23Z: the triage comment
  [6394844909](https://github.com/shader-slang/slang/issues/13904#issuecomment-6394844909) was posted, the
  `reproduced` label added, and Type set to Bug (bug / P2). The triager recommended approach A (std430 on both
  sides, IR rule Std430 not Natural, emit `requires uniform_buffer_standard_layout;`). It asked jkwak-work
  whether a capability gate is needed. Memo: `memory/issues/triage-13904.md` in the triager group.
- 08:35Z: the reporter opened **PR #13935** (`wgsl/uniform-standard-layout`, closes #13904, not a draft). The
  reporter answered the brief in
  [6397391262](https://github.com/shader-slang/slang/issues/13904#issuecomment-6397391262) and prefers
  `requires` alone, without a gate.
- 12:21Z: the triager built #13935 at `a2ee40c` and confirmed the claims (`tests/wgsl/` 98/0, default CB
  byte-identical). It posted [6397570979](https://github.com/shader-slang/slang/issues/13904#issuecomment-6397570979)
  with two non-blocking notes:
  1. `requires` is always emitted, even when the layout does not need it, so a valid vec3/matrix module
     needlessly fails on naga and Safari.
  2. The `wgsl-spirv*` change is covered only by a Tint row, which is ignored on Linux.
- The triager cancelled re-check `t-2817d8` because its trigger had fired.

**Disposition: parked, no fixer dispatch.** Same pattern as [#13902](13902-wgsl-static-const-array-private-limit.md):
this reporter files with their own PR. Decision owners:
- jkwak-work: the capability gate. The reporter's preference is not a maintainer answer.
- dshreiner-nv (requested reviewer) and kaizhangNV: the review of #13935.

**Cross-chain.** #13935 contains the same one-line `!isWGPUTarget(targetReq)` change in
`getTypeLayoutRuleNameForBuffer` as bot draft #13402
([13391-wgsl-tint-std140.md](13391-wgsl-tint-std140.md)). Whichever lands second needs a trivial rebase. If
#13935 lands first, the #13402 owner should merge master. There is no overlap with Metal draft #13425.

**Resume on:**
- a human comment on #13904 or #13935, through the webhook to slang-triager on the thread above;
- #13935 merging: the triager sends a FINAL note and removes worktree `/workspace/agent/wt-13935`, and I tell
  the #13402 owner on `gh-issue-shader-slang/slang-13391` to merge master;
- an operator ask.

No timer is set. This entry is the parked-chain register record.
