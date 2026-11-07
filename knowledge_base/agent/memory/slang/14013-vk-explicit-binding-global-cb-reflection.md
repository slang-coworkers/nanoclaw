---
type: chain
title: slang#14013 — explicit vk::binding(0) + global uniform puts the default CB binding on the global-scope var layout
description: External bug (albertrodriguezclo), triaged and reproduced 10-29. Fix approach A goes to slang-fixer. I authorized a companion slang-rhi issue for bindAsRoot.
---

# slang#14013 — the default CB binding lands on the scope var layout

- **Opened** 2026-10-29 12:40Z by albertrodriguezclo, an external reporter. The same person filed fork PR #13911.
  Repro: `[[vk::binding(0)]] RWStructuredBuffer<uint> result; uniform uint value;` gives a SPIR-V
  CB at binding 1, but `getGlobalParamsVarLayout()` has offset 1, so the reflection walk puts `result` at 1.
- **Triage (slang-triager, 12:58Z):** bug, high severity, P2, not a regression (the code dates from 2017/19). Producer is
  `slang-parameter-binding.cpp:4787-4793`. Reproduced at 01dcd3568, including the Vulkan runtime on the L40S. The triager reports
  that it is wider than the issue says: a real SPIR-V double Binding 3 (struct uniform with a texture), plus `-fvk-bind-globals`,
  D3D `register(b0)`, `getGlobalConstantBufferBinding`, and JSON `globalScope`. Recommended approach is A: move the binding onto the
  scope's `containerVarLayout` and update the consumers. Comment `6497305159` was verified by Main as posted by
  nv-slang-bot at 12:57:47Z. Labels: `reproduced`, Type=Bug. The memo is at `/workspace/inbox/a2a-1793278699373-nj66a1/triage-14013.md`.
- **Sessions on `gh-issue-shader-slang/slang-14013`:** triager `sess-1793277713654-805mg8`, fixer
  `sess-1793278619066-ts4vfj` (handoff from the triager at 12:56Z).
- **slang-rhi companion:** the `vk-shader-object.cpp:302-306` TODO in `bindAsRoot` names exactly this case
  (Main verified it at 314cfb5). WGPU has the same TODO. The reporter's runtime case needs both fixes.
  **10-29 Main authorized the triager to file a slang-rhi tracking issue.** It may link #14013 (same org),
  and no rhi fix PR is opened until the slang reflection shape settles. When the rhi issue's
  `issue_opened` webhook arrives, it is bot-filed and owned by this chain, so dispatch nothing.
- **slang-rhi#959 filed** 13:01:07Z by nv-slang-bot, label `bug` (Main verified). The #14013 comment 6497305159 was edited at 13:01:29Z to link it (verified).
  The fixer was told (triager msg 17). The slang PR needs no rhi change. A Vulkan render test of the repro fails until #959 lands, so slang
  acceptance is filecheck/reflection only. **The rhi#959 `issue_opened` webhook is owned by this chain: dispatch nothing.**
- **14:59Z: #959 is CONFIRMED REAL (it was briefly in doubt at 14:56Z).** The test used the Slang fix, rhi b856e635 and VVL 1.3.239 on the L40S. Layout VUIDs are gone, but
  the write path still shows `VkWriteDescriptorSet-descriptorType-00319` (UBO written into the binding-0 SSBO) and `vkCmdDispatch-None-02699`
  (binding 1 never written). NVIDIA driver 595.91.07 accepts the invalid write and returns 1234. The fixer's runtime pass was a FALSE PASS.
  #959 body (14:58:21Z) and #14013 comment (14:58:32Z) were edited with this evidence; Main checked both. The fixer's PR says
  "Related: slang-rhi#959" and has no GPU regression test, since that test would pass on NVIDIA for the wrong reason. The operator was corrected at 15:00Z.
  ⭐ A Vulkan runtime pass on NVIDIA without the validation layer is not evidence that the descriptor writes are valid.
- **15:08Z: bot DRAFT PR #14023** `fix/issue-14013@0f6d588bd`, `pr: non-breaking`, body has `Fixes #14013` + `Related: slang-rhi#959` (Main verified).
  It touches 15 files: parameter-binding, emit-spirv/metal, ir-metadata, ir-util, coverage-instrument, reflection-api, 2 new tests, a unit test, and 2 `.expected` files.
  The fixer reports slang-test at 11276/11279; the 3 fp8 CUDA PTX-JIT failures it calls unrelated were not checked by Main. Draft CI skipped 54 checks.
  The open question I sent the triager: does a change in what the public reflection API reports (scope offset 1→0, `getGlobalConstantBufferBinding`) still fit `pr: non-breaking`?
- **15:59Z settled:** the Risk line says "Label: maintainers decide" (consumer audit is in the explanation comment). fp8 failures reproduce at base 9b3ac252d, so unrelated.
  Status comment 6500432543 is posted. Review went to slang-reviewer.
- **D3D12 merge blocker (code-read only):** rhi `addAsConstantBuffer` (`d3d12-shader-object-layout.cpp:644-663`) ignores the container offset.
  With `cb : register(b0)` + uniform, the binding goes from b1/b2 with b0 missing to swapped b0/b1, broken both before and after. Same path as dormant slang-rhi#289 (tdavidovicNV, 2025-04, "for reference").
  **Decision (c):** the finding stays on #14023, with a reference to #289 as the tracker. It does not go into #959. **Standing authorization to the triager:** once a real D3D12 run backs it
  (a Windows CI leg of #14023, or a register(b0)+uniform test), post the observed before/after on #289 with the run cited, then report. Operator told 16:00Z.
- **17:25Z: R1 review APPROVE_WITH_NITS @0f6d588bd** (slang-reviewer, combined review at `/workspace/inbox/a2a-1793294550736-7gpbw7/combined-review.md`).
  0 bugs and 3 gaps. G1: stale docs in `09-reflection.md:749-750` and `slang-type-layout.h:964-970` ("container offsets zero"). G2: an untested HLSL/Metal
  split-out CB codegen fix. G3: untested `-fvk-bind-globals` with no uniforms. There are also comment nits, plus an optional FG007 space-offset variant that is the fixer's call.
  The reviewer reports its remedy tests pass 4/4 on head and 0/4 on base and were sent to the fixer; Main could not confirm, because `ncl sessions messages` on the fixer session timed out.
  The review is not on GitHub (no auth marker, which is correct). Still for humans: the D3D12 CBV swap, and the label `pr: non-breaking` vs the body's "maintainers decide".
- **18:58Z: Triage RESOLVED.** #14023 is still a draft @1236549a8: 8 commits, 21 files, +756/-38 (Main verified). The R1 nits are applied. FG007 is deferred as a TODO
  because it would change the reported set of explicit-space user CBs that rhi's Vulkan set enumeration reads. The fixer reports 11299/11302; the 3 fp8 failures also fail at base.
  Status comment 6500432543 is current. **Label decision (Main, 10-29):** keep `pr: non-breaking`, because the repo requires one of the two labels and this is no ABI/language
  break. The body is to state why, and that maintainers may relabel.
- **PARKED on the operator's un-draft sign-off** (asked on the orchestrator-dashboard thread gh-issue-shader-slang/slang-14013, 10-29 ~19:00Z). After that, maintainers decide the D3D12
  question and the label. Re-chase `rechase-slang-14013-r1-3357` at 10-31 16:00Z. ⚠️ When it goes ready, check `paused` before forwarding the approver webhook.
- **10-31 16:00Z re-chase r1 (`rechase-slang-14013-r1-3357`): no change.** #14023 is still an OPEN draft at `1236549a8`, label `pr: non-breaking`, 0 reviews, last updated 10-29 19:04Z.
  No human comment on #14023, #14013 or slang-rhi#959 since 10-29 (only bot rows). No operator answer: Main `4lc0u2` has no inbound after row 92, and the dashboard session paged
  bounded (seq 509126→509724, to 10-31 15:55Z) has no reply to the 10-29 19:03Z ask. Action: ONE re-ask of the un-draft sign-off to `orchestrator-dashboard` on thread
  `gh-issue-shader-slang/slang-14013` (msg id 25). Nothing went to the triager or fixer; nothing was posted on GitHub. `task-hygiene.py next` allowed r2 (count 1 of cap 3);
  one-shot `rechase-slang-14013-r2-67eb` is scheduled for 11-02 16:00Z.
- **11-02 16:00Z re-chase r2 (`rechase-slang-14013-r2-67eb`): no change.** #14023 is still an OPEN draft at `1236549a8`, `pr: non-breaking`, 0 reviews, last updated 10-29 19:04Z.
  No human comment on #14023, #14013 or slang-rhi#959 since 10-29; rhi#289 untouched since 2025-05. Dashboard session paged bounded (seq 509726→510122, to 11-02 16:01Z):
  the only 14013/14023 row is my own 10-31 re-ask; no operator answer. Action: third ask to `orchestrator-dashboard` on thread `gh-issue-shader-slang/slang-14013`
  (msg id 7), saying the 11-04 re-check is the last. Nothing went to the triager or fixer; nothing was posted on GitHub. `task-hygiene.py next` allowed r3 (count 2 of cap 3):
  one-shot `rechase-slang-14013-r3-3c49` at 11-04 16:00Z, told to park with no timer if still unanswered (cap reached).
- **11-04 16:00Z final re-chase r3 (`rechase-slang-14013-r3-3c49`): PARKED, NO TIMER.** #14023 is still an OPEN draft at `1236549a8`, `pr: non-breaking`, 0 reviews, last updated 10-29 19:04Z.
  No human comment on #14023, #14013, slang-rhi#959 or rhi#289 since 11-02. **New, maintainer triage only (no comments):** on 11-02, jkwak-work assigned #14013 to themselves and milestoned it
  `Q4 2026 (Fall)`. rhi#959 is assigned to jkwak-work (event by jhelferty-nv 18:18Z) and milestoned `Q1 2027 (Winter)`. Dashboard session paged bounded (seq 510122→510814, to 11-04 16:01Z):
  the only 14013 row is my own 11-02 ask (510130); no operator answer to any of the 3 asks. Action: ONE park line to `orchestrator-dashboard` on thread
  `gh-issue-shader-slang/slang-14013` (msg id 7), with reopen on "un-draft 14023" or GitHub activity. `supervisor-state.json` row now carries disposition `parked:no-timer — ready-flip pending`
  (weekly list, per [undraft-asks-replaced-by-weekly-list](../orchestrator/undraft-asks-replaced-by-weekly-list.md)). `task-hygiene.py next` → `allowed:false, parked:true` (count 3 of cap 3), so nothing is scheduled.
  Nothing went to the triager or fixer; nothing was posted on GitHub. **Next:** webhook-driven only. A human comment goes to slang-triager on this thread, quoted verbatim. On ready_for_review, check `paused` before routing to the approver.
- **11-06 22:56Z: reporter comment on #14023** (albertrodriguezclo, CONTRIBUTOR, [6697864196](https://github.com/shader-slang/slang/pull/14023#issuecomment-6697864196)).
  It confirms this is the fix they suggested, and says they would call it a behaviour change rather than `pr: non-breaking`. **It asks for the PR to land together with rhi#959 and the
  D3D12 #289 read**, so slang-rhi users never get swapped CBVs. They offer a validated slang-rhi run once both rhi pieces exist. The fixer replied at 23:01Z ([6697929684](https://github.com/shader-slang/slang/pull/14023#issuecomment-6697929684)),
  handing the label and the landing order to maintainers. Main verified both comments, and that the PR is still a draft @1236549a8 with 0 reviews and PR assignee kaizhangNV.
  rhi#959 is assigned to jkwak-work and milestoned Q1 2027. **Main decision 11-06:** no operator ask (weekly-list policy, 11-03); there is no plain ready-flip,
  because the ready-flip is HELD on the maintainers' landing-order decision (supervisor-state disposition updated). No bot rhi work while #959 has a human assignee.
  No new GitHub post, because the fixer's 23:01Z reply is the current artifact. If the reporter posts a real Windows D3D12 run, the #289 standing authorization applies.
