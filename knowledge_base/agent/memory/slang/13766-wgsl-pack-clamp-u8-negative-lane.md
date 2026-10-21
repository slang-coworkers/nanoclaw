---
type: chain
title: slang#13766 — WGSL pack_clamp_u8(int4) clamps negative lanes to 255
description: Human-filed (albertrodriguezclo) WGSL wrong-result bug in packUint4x8Clamp(int32_t4); routed to slang-triager 2026-10-20
---

# slang#13766 — WGSL: `pack_clamp_u8(int4)` gives 255 for a negative lane

- Filed 2026-10-20 12:49:00Z by albertrodriguezclo (external; same reporter as #13739, #13753,
  slangpy#1232). Filed in one batch with #13765, #13767, #13768 (12:48:58–12:49:03Z). Each issue has
  its own Main webhook session.
- Bug: `packUint4x8Clamp(int32_t4)` on WGSL emits `pack4xU8Clamp(vec4<u32>($0))`
  (origin/master `source/slang/hlsl.meta.slang:35904`). The u32 conversion runs before the clamp, so
  -1 → 255 instead of 0. The reporter proves it with a Tint const_assert. Proposed fix:
  `max($0, vec4<i32>(0))` before the conversion.
- 12:52Z ownership check: live state open, 0 comments, no labels, unassigned, updated_at ==
  created_at. The only session on the thread is my webhook session `sess-1792500541846-fmbwm9`.
  No task names it. Not held under R6: nanoclaw #1993 is still a draft.
- 12:53Z: dispatched to slang-triager on `gh-issue-shader-slang/slang-13766` (msg 13). Asked it to
  verify the other overloads and check overlap with the reporter's open PRs. **No fixer until the
  triage memo is back.** The reporter often opens their own PR.
- 12:53Z triager progress (msg 12): no overlap. Siblings #13765/#13767/#13768 are other areas, and
  none of the reporter's open PRs (#13764, #13769, …) touches `pack4xU8Clamp`. It is now auditing
  the WGSL pack/unpack family and reproducing on master.
- 12:59Z `[Triage]` (msg 14; memo `/workspace/inbox/a2a-1792501158792-dgkazs/triage-13766.md`):
  bug / medium / P2, WGSL emit in the core module. Not a regression (wrong since 7a6de4aea, #5934,
  2024-12-28). GPU repro on L40S with node webgpu on Vulkan: 3 of 3 vectors wrong on master; vk, cuda
  and cpu are correct. The family audit found that only `hlsl.meta.slang:35904` converts before it
  clamps. Options: **A** is the reporter's `max($0, vec4<i32>(0))` (recommended); **B** deletes the
  wgsl case and uses the default path. Both are GPU-verified. The existing `pack-unpack.slang` input
  has no negative lane, and its -wgpu rows are ignored on Linux, so a WGSL filecheck test is also needed.
  - Verified ~13:01Z: `reproduced` + Type=Bug are on the issue. Line 35904 matches. Public triage comment
    [6291418944](https://github.com/shader-slang/slang/issues/13766#issuecomment-6291418944) (nv-slang-bot,
    12:59:49Z, the only comment) landed after the triage report. My first read came before it and showed 0.
  - The triager handed it straight to slang-fixer. Fixer session `sess-1792501168744-bp6g0t` is on
    the canonical thread (handoff at its seq 2). The handoff says to stand down if the reporter opens
    a PR.
  - Out-of-scope finding, not filed: WGSL `D3DCOLORtoUBYTE4` (`hlsl.meta.slang:10170`,
    `bitcast<vec4i>(pack4x8unorm($0)).zyxw`) is rejected by Tint, and I found no existing issue
    (verified). Whether to file it is the operator's decision.
- 13:02Z: fixer status: building on `fix/issue-13766` in a fresh worktree, ETA ~25 min. It found no
  reporter PR as of 13:00Z.
- **13:16Z: the reporter opened PR #13775** ("WGSL: clamp negative lanes to 0 in packUint4x8Clamp(int32_t4)",
  branch `fix/wgsl-pack-clamp-u8-negative`, head `33c248827c`, ready, `Fixes #13766`, no labels). They
  commented "Fix in #13775, so no need for a second one. Thanks for checking both forms on a GPU." (cmt
  6291742229, verified live, unedited, no @-mention, so it is not a summons and needs no bot reply).
  Verified diff: exactly option A at 35904, plus `tests/bugs/gh-13766-wgsl-pack-clamp-u8-negative.slang`
  (negative-lane inputs on wgpu/vk/dx12/metal/cpu/cuda + a WGSL `SIMPLE` filecheck `COUNT-4` on the
  `max(..., vec4<i32>(0))` text). That meets triage acceptance 1 and 2. CI at 13:17Z: 2 pass, 3 pending.
  - The fixer `bp6g0t` had pushed nothing (no `fix/issue-13766` branch upstream, no PR). It is blocked
    on an `ask_question` from 13:02:50Z, which I can't read. Told slang-triager (the fixer's parent) to
    have the fixer stand down and to verify #13775. The operator may have a dangling fixer card.
- 13:19Z `[Triage Resolution]` (msgs 38/42, duplicates): abandoned on our side, the reporter's PR is
  the fix. #13775 @33c248827c meets all 4 acceptance criteria. The PR test FAILS on master's WGSL
  filecheck and passes vk, cpu and cuda. The PR's change was simulated on the L40S (expected values),
  but no build at the PR head was run. Verified 13:20Z: no `fix/issue-13766` ref upstream, the only PR
  is #13775, and the fixer received the stand-down (its seq 6). Its confirmation was not back yet.
  - CI at 13:20Z: CI, Check Formatting, REUSE and Verify PR Labels are **action_required** (a
    maintainer must approve them). Claude PR Review is in progress. 0 reviews, no labels.
  - **Parked on:** maintainer CI approval + review/merge of #13775. One-shot re-check
    `rechase-13766-pr13775-b090` at 2026-10-23 15:00Z. Still open for the operator: whether to file the
    `D3DCOLORtoUBYTE4` WGSL bug.
- 13:41Z (triager msg 52): the fixer's [Fix Report] confirms the stand-down. Its worktree, local branch
  and sentinel are removed. Nothing was pushed (the triager ran `ls-remote`: no `fix/issue-13766*` ref).
  The unpushed series is kept in the fixer's workspace at `/workspace/agent/patches/fix-13766.patch`.
  Every bot tier is closed. The triager sends one final message when #13775 merges. The only live
  timer is `rechase-13766-pr13775-b090`.
- 13:41Z (triager msg 54): the fixer said "this session sent no question at 13:02Z" (its seq 13), and the
  triager concluded a second fixer session existed. **False, checked 13:43Z:** `bp6g0t` is the ONLY
  slang-fixer session on the thread. Its own outbound seq 7 is the 13:02:50Z `[system: ask_question]`
  (kind `chat-sdk`). The same session got the stand-down (seq 6), sent the [Fix Report] (seq 11) and then
  denied seq 7 (seq 13). The pin landed correctly, there is nothing left to relay, and I told the triager.
  Lesson: a session's memory of its own rows is not evidence; its `messages_out` is. Same detector as the
  "two running sessions in one group" rule in CLAUDE.md.
