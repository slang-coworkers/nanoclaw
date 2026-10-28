---
type: chain
title: slang PR #13911 — WGSL WaveGetNumWaves → num_subgroups; follow-up issue for slang-test's Dawn
description: "Fork PR by albertrodriguezclo. 2026-10-27 jkwak-work (APPROVED) asked the bot to file a follow-up issue, assigned to them: upgrade slang-test's Dawn and re-enable the disabled -wgpu run. Filed as #13967 (assigned to jkwak-work, verified). Approver event queued (approver paused)."
---

# slang PR #13911

**2026-10-27 23:11Z, two webhooks in Main session `sess-1793142688280-orsb97` (thread `gh-pr-shader-slang/slang-13911`).**
Live read: OPEN, fork head `albertrodriguezclo:wgsl/wave-get-num-waves-builtin` @ 2997db60de9b, `pr: non-breaking`,
jkwak-work APPROVED, CI 55 pass / 1 pending / 2 skipping, no pr-mapping, no closing keyword.

- **Row 2, `pr_mention`** (inline r4394898724 on `tests/hlsl-intrinsic/wave-get-num-waves.slang:12`, the line that
  disables the `-wgpu` run): *"please create a new issue to follow up on this; and assign it to me. We need to upgrade
  Dawn used in the slang-test framework; and re-enable this test."* Dispatched to `slang-fixer`, MODE=pr-review-fix,
  `<github-post-authorized />`, in_reply_to 2, thread `gh-pr-shader-slang/slang-13911` (msg 13). It must dedup against
  #13861 (bundled slang-tint, a `wgsl-spirv-asm` path) and #13807 (pinned Dawn 7204, ShaderF16), both jkwak-work's, and
  must not touch the fork PR.
- **Row 4, `pr_ready_for_review` (synchronize):** `slang-pr-approver` is paused, so not forwarded; queued in
  `data/approver-pause-queue.md`.

**23:38Z, fixer [Report] (msg 16), verified by Main.** The bot filed **#13967** at 23:36Z: "slang-test: update the Dawn used by
`-wgpu` and re-enable the WebGPU lane of `wave-get-num-waves.slang`". It is OPEN, assigned to jkwak-work, with the label `WebGPU`, and cross-links #13807/#13861.
The inline reply r4395389525 (23:37Z) answers r4394898724. The fixer's evidence (not checked by Main): slang-rhi pins Dawn `138.0.7204.168`
(slang-rhi `CMakeLists.txt:277`, still the newest webgpu-dawn-binaries release). Tint gained `num_subgroups` between chromium/7499 and 7559.
The L40S repro fails with `expected builtin value name`; vk and cuda pass.

**Terminal for the bot.** #13967 is jkwak-work's work item. The PR still waits on approval, which is queued while the approver is paused.
