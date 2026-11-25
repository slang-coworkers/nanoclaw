---
type: chain
title: slang#14415 — NVIDIA Vulkan (RTX 5080, 617.14) nondeterministic skipped float3 component in rolled loop with continue
description: Human-filed (j8asic) NVIDIA driver bug, triaged 2026-11-09, RESOLVED 2026-11-23 — reporter confirmed fixed in driver 621.x; maintainer closes; no Slang-side defect
tags: [slang, spirv, vulkan, nvidia-driver, dynamic-index, triage]
---

# slang#14415 — dynamically indexed float3 accumulator, rolled loop + `continue`, NVIDIA Blackwell

- Filed 2026-11-09 ~08:56Z by j8asic. No labels, no assignees, 0 comments at dispatch (live read).
  `grep 14415 memory/slang/` had no hits; no existing triager session.
- Report: `float3` accumulators indexed by a rolled `for (a < 3)` loop index with `continue`; a skipped
  component sometimes comes back nonzero, nondeterministically. `[ForceUnroll]` avoids it. RTX 5080,
  Windows driver 617.14, slang-rhi/SGL, Slang 2026.19–2026.21 (`-O2`). Slang emits a Function-storage
  `v3float` + `OpAccessChain %_ptr_Function_float %diag %a` + `OpStore`; spirv-val passes. The reporter's
  reduction does NOT reproduce on RTX 4090 / Linux 615.78.08. Asks: known driver issue? would Slang emit
  selects / `OpVectorInsertDynamic` on SSA for NVIDIA?
- 2026-11-09: dispatched to slang-triager on `gh-issue-shader-slang/slang-14415`. Our GPU is L40S (Ada,
  Linux), so a repro of the Blackwell/Windows symptom is not expected here; triage focuses on whether
  Slang's SPIR-V is valid and whether an alternative emission is reasonable.
- 2026-11-09 09:47Z `[Triage]` (slang-triager; comment 6737002508 verified live, first comment on the issue; Type=Bug
  set, no labels): bug, likely a downstream driver miscompile, medium, P2, target-emit (SPIR-V); no dup (#12786 is a different
  NV pipeline-creation hang). Clean on L40S/Linux 595.91.07 (fp32/half × -O0/-O2, 200×2M each; unroll + select 20 each;
  lavapipe clean); a planted-bug control is caught. -O2 SPIR-V matches the report and validates. Codegen facts (their
  finding): `isPromotableVar` (slang-ir-ssa.cpp:478) never promotes partial stores; no `OpVectorInsertDynamic` emit; spirv-opt
  promotes constant-index chains only, which is why `[ForceUnroll]` "fixes" it. Q2 options A (no change) / B (partial-store SSA +
  OpVectorInsertDynamic, all vendors) / C (select-rewrite legalization) / D (vendor mode, not recommended).
  Memo: /workspace/inbox/a2a-1794217676716-qk6p4v/triage-14415.md; scratch /workspace/agent/scratch-14415/.
- PARKED on two owners: reporter (attach failing SPIR-V; A/B select rewrite; -O0; gs written after barrier?) and a maintainer
  with a driver-team contact (forward to NVIDIA? pick Q2 option). No fixer. Triager one-shot re-check 2026-11-12 09:30Z.
  Decision named on the operator dashboard 11-09.
- 2026-11-09 17:40Z jkwak-work (MEMBER) commented "This sounds like a graphics driver bug." (cmt 6747075886) and labeled
  `Vendor Driver Bug`. They self-assigned at 17:38:50Z and unassigned at 17:39:59Z, so the issue now has no assignee. It came in as a
  `pr_mention` webhook, but the live body has no `@nv-slang-bot`, so it is not a bot mention and carries no post authorization.
  This answers part of the maintainer decision: the issue is classified as a driver bug. Nobody has said whether it goes to NVIDIA,
  and nobody has explicitly picked a Q2 option. Relayed verbatim to slang-triager; told the dashboard.
- 2026-11-09 17:42Z triager [Report]: still parked; it made no post (no mention), and Type=Bug stays. Re-check task **t-ddf365**
  at 2026-11-12 09:30Z, its prompt updated with the maintainer verdict. The issue has no assignee, so no maintainer owns the
  NVIDIA-forwarding decision or Q2.
- 2026-11-09 18:25Z jhelferty-nv (MEMBER) commented "@j8asic Can you check if this was fixed in 621.14? I believe it fixes a
  very similar-sounding bug." (cmt 6748019430). They also labeled `Needs reporter feedback` and **self-assigned** (18:25:47Z,
  assigner = themselves). This is not a bot mention. **HELD, rung 4:** a maintainer owns the issue, so the bot makes no posts.
  Relayed to the triager with a suggestion to cancel t-ddf365, since the reporter's reply arrives by webhook. Told the dashboard
  that my earlier decision ask now has an owner.
- 2026-11-09 18:26Z triager [Report]: holding under rung 4. It cancelled t-ddf365 and removed the active-work sentinel. It will act
  only on a relayed webhook, such as a reporter reply on driver 621.14 or a bot mention. RESTING.
- 2026-11-23 jhelferty-nv re-pinged the reporter (cmt 7110824639): "@j8asic Checking in, did you have a chance to test if the
  newer driver fixed this for you?" Live body has no `@nv-slang-bot` — not a bot mention. No state change: reporter silent since
  11-09, jhelferty-nv still assignee, labels unchanged (Needs reporter feedback + Vendor Driver Bug). Triager session
  sess-1794214647063-qdddiv on the thread is active/resting (container stopped, NOT cost-stopped) and will wake normally when a
  reporter reply or bot mention is relayed. Not relayed this time — the comment is addressed to the reporter, changes no decision,
  and the triager's resting condition is unmet; relaying would only mint a content-free round trip.
- 2026-11-23 20:09Z j8asic replied (cmt 7112654686, verbatim): "@jhelferty-nv Thanks. I updated to driver 621.24 and tested. On
  617.14, my kernel family failed in about 9 of 10 long runs, so I think 621.x fixed it. We'll keep the [ForceUnroll] workaround
  for users on older drivers. I'm fine with closing this as a driver issue that's fixed in 621.x." This is the activating webhook
  the resting triager waited for. Not a bot mention (no post authorization). Relayed verbatim to the triager owner session
  sess-1794214647063-qdddiv (pin + thread_id + in_reply_to=34-recipe; landed seq 32, verified) — awaiting its disposition report.
  Expected terminal state: maintainer closes as driver-fixed-in-621.x; bot posts nothing.
- 2026-11-23 20:10Z triager [Report] (msg 40): **RESOLVED, chain closed on our side.** No Slang-side defect, no fixer action, no
  code change; driver 621.24 fixes it, `[ForceUnroll]` stays as a workaround for older drivers. No GitHub post (no mention);
  closing + `Needs reporter feedback` label cleanup are maintainer-only — jhelferty-nv (assignee) closes at their convenience,
  reporter already consented on-thread. No sentinel, no tasks, nothing in flight. Triager's own record: its
  `memory/issues/14415.md`. Told the dashboard. TERMINAL — no ack sent to the triager (content-free round trip).
- 2026-11-23 23:49:49Z jhelferty-nv closed the issue (`state_reason: completed`), removed `Needs reporter feedback`, kept
  `Vendor Driver Bug`; their "@j8asic Thanks for confirming!" (cmt 7117408808) is a courtesy close-out with no bot mention —
  not relayed (chain already terminal). Predicted terminal state realized; chain fully closed.
