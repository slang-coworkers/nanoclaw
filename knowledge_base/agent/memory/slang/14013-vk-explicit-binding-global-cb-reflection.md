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
