---
type: chain
title: slang#13789 — isParameterLocationUsed marks an unused resource used when its constant buffer also holds ordinary data
description: External (fuchstraumer) 10-20. Triaged (cmt 6298782357, reproduced, P2). Root cause in type legalization (declareVars pair case), not the metadata pass. Draft PR #13811 @8921fd5 (fixer session 4lrs0a), Fix Report 10-21 16:17Z; PARKED on maintainer review + operator call on filing a pre-existing PB-in-CB binding bug. Re-check one-shot 10-24 15:00Z.
tags: [slang, reflection, metadata, type-legalization, triage]
---

# slang#13789 — usage metadata for a split mixed constant buffer

**10-20 18:37Z `issue_opened`**, reporter fuchstraumer (external), with a C++ API repro. Dispatched to
`slang-triager` on `gh-issue-shader-slang/slang-13789`. The triager handed off to `slang-fixer`
directly; per ANCHOR H I dispatch nothing to the fixer.

**Triage (verified live):** cmt 6298782357 (nv-slang-bot, 18:58:32Z), label `reproduced`. ToT
`7251cc60b`. The triager found that the bug also hits HLSL, GLSL and a global `ConstantBuffer<P>`;
loose globals and `ParameterBlock<P>` are correct. Cause: `declareVars` pair case in
`slang-ir-legalize-types.cpp` (~:3463) gives the leftover data-only buffer the whole group's layout.
The metadata pass (`collectMetadataFromInst`) is only where it shows. Approach A (rebuild the layout
at legalization) avoids conflict with draft #11135, which also edits `slang-ir-metadata.cpp`.

**PR #13811 (verified live 10-21 09:4xZ):** draft, `fix/issue-13789`, `Fixes #13789`, mapped to fixer
session `sess-1792522685603-4lrs0a`. The Metal `TextureBuffer<P>` emit change (it drops a colliding
`[[buffer(1)]]`) is disclosed on the PR body's Risk line, so a maintainer must accept it. Issue
status cmt 6312814788 was posted by the fixer.

**10-21 13:09Z (fixer's claim):** R1 REQUEST_CHANGES (1 Debug-build crash on valid HLSL + 4 gaps)
fixed, head `ccb72c9`; R2 requested from slang-reviewer. Full suite 11012/11015 (fp8-cuda ×3, also on
master).

## Open operator decision — side filing

The reviewer asked for a separate issue: for a `ParameterBlock` inside a `ConstantBuffer`, reflection
reports the block's buffers one binding lower than the SPIR-V declares. The fixer says it confirmed this
on master and drafted the issue in ITS container (`reports/issues/pb-in-cb-binding-mismatch.md`), not filed.
Duplicate search 10-21: no exact match. Related open: #8441 (D3D12 `ParameterBlock<ConstantBuffer<T>>`
register-space mismatch), #11147 (rhi vk assert on `ParameterBlock<ConstantBuffer<T>>`). Asked on
`orchestrator-dashboard` 10-21; ask once, never re-ask. It does not block #13811.

**10-21 16:17Z [Fix Report] (head verified live: draft, `8921fd5`, `pr: non-breaking`).** R2 was
REQUEST_CHANGES (1 bug + 1 gap); the fixer applied both, no R3 round (2-round cap). The reviewer's
existential `.slang` test was replaced by a release-only unit test, because Debug stops at a tuple-case assert
that master also hits. Combined-sampler arrays still under-report on HLSL, as on master. Explanation
comment 6312788509 is at head 8921fd5; issue status cmt 6312814788 was edited 16:14Z. CI run 39632652685
(workflow_dispatch) is `waiting` on `falcor-build-approval-gate`. The fixer sent the [Fix Report] to me, not to the triager (triager session `911hoa` has no inbound
after 09:38Z), so I relayed it there for the Triage Resolution.

**My own miss, 13:11Z:** I put the fixer instruction ("hold the filing, send me the draft") as plain
text NEXT TO a `<message to="orchestrator-dashboard">` block. Only the dashboard row went out (my session
`2to2nq` row 43; fixer session `4lrs0a` has no inbound from me after 09:43Z). When a final response
holds a `<message>` block, text outside it is scratchpad. Every instruction to a peer goes in its own
block or `send_message`. The fixer held the filing anyway, unprompted. Re-sent 16:2xZ, pinned to `4lrs0a`.

**Parked:** maintainer review (incl. Metal) + operator filing call. One-shot `rechase-13789-pr13811`
10-24 15:00Z.

**10-21 16:25Z:** the fixer sent the draft (1487 B; confirmed on fork point `25fc396601`; a top-level
`ParameterBlock` control shows no shift). Forwarded to `orchestrator-dashboard` via `send_file`. Nit for whoever files:
the repro reads `unusedBuf`, so the name misleads. Still unfiled, pending the operator.

**10-21 16:25Z [Triage Resolution]:** the triager's side is closed. Draft PR #13811 is not merged, and the triager posted nothing new on
GitHub (the fixer's cmt 6312814788 is current). Remaining human actions: falcor gate approval (CI), maintainer review +
Metal acceptance, and the operator filing call. All three are named on the dashboard; the draft was sent 16:25Z.

**10-21 16:25Z fixer addendum (the reviewer closed its chain on 8921fd5 and accepted the release-only test):** existential-with-resources
is untested in Debug, and the Debug-only `SLANG_ASSERT(fieldLayout || !typeLayout)` in the `declareVars` tuple case
fires for existential and `Ptr<Struct-with-resource>` shapes. It is a separate problem that also exists on master; not filed.
On GitHub, explanation cmt 6312788509 item 71 discloses the existential case only; `Ptr<…>` is named nowhere public.
A second unfiled side bug. Added to the same open filing question on the dashboard 10-21 16:3xZ; the operator answers both together. The 10-24 task prompt covers both.

**10-21 16:39Z maintainer comment (verified live): jkwak-work (MEMBER), cmt 6321256810, addressed to the reporter, not
the bot.** He says entry-point ordinary `uniform`s become a SPIR-V push constant, not a constant buffer, and that he is "not sure
if `isParameterLocationUsed()` is supposed to work for the variables in a push-constant". He will "discuss about this later
this week". There is no `@nv-slang-bot` mention, so no post authorization. Forwarded verbatim to the triager (issue owner) on the canonical thread.
Orchestrator note (mine): the locations queried are resource descriptor bindings (`unusedBuf`), not push-constant members,
and triage cmt 6298782357 already shows the bug on WGSL/HLSL and for a global `ConstantBuffer<P>` (no push constant).
**Chain now parked on jkwak-work's discussion**; PR #13811 stays draft and unchanged. The 10-24 one-shot covers this.

**10-21 16:45Z triager parked (verified the comment live; posted nothing).** It confirmed my note against its repro memo:
the bad locations are `DESCRIPTOR_TABLE_SLOT` bindings; WGSL (`var<uniform>` at b1, no push constant) and HLSL (`t1`) are also wrong,
and so is a global `ConstantBuffer<P>` on all 4 targets. **Caveat to carry:** on SPIR-V the leftover data-only buffer IS the
push-constant block, and its stale layout is how the false positive arises there. Whether `isParameterLocationUsed` should
report push-constant usage itself is a separate question (#5685, #13713), which #13811 does not change. A short factual reply is ready if
someone asks or @-mentions the bot.
