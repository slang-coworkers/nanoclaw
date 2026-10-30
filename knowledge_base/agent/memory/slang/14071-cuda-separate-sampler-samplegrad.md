---
type: chain
title: "slang#14071: CUDA/PTX separate-sampler SampleGrad rejected while separate-sampler SampleLevel drops the sampler"
description: "Human feature request (minco3, follow-up to #13556/#13559) 10-29 23:56Z. Its preferred fix (ignore s, reuse tex*Grad) is the lowering jkwak-work rejected in #13559 review. Triaged feature/low/P3, parked for jkwak-work (A/B/C; triager leans B docs-only). R6 hold to 11-02 23:56Z; re-check t-3160ea 11-03 00:10Z posts the comment. Gather CUDA-arm side bugs F1-F4 (ICE + silent wrong result) filed as bot issue #14073 (10-30 00:11Z), owned by this chain."
tags: [cuda, texture, samplegrad, r6, maintainer-decision]
---

# slang#14071: CUDA separate-sampler `SampleGrad` vs `SampleLevel` asymmetry

**Filed** 2026-10-29T23:56:25Z by minco3 (same reporter as [#13556](13556-cuda-samplegrad.md) and #13555). No labels,
no assignee, 0 comments at dispatch (checked live).

**Ask.** On CUDA/PTX, `Texture2D.SampleLevel(SamplerState, ...)` compiles and drops `s` (`tex2DLod`), but
`Texture2D.SampleGrad(SamplerState, ...)` is E36107. Preferred: lower separate-sampler `SampleGrad` the same way
(ignore `s`, reuse the #13559 `tex*Grad` lowering). Alternative: document why the two differ. The lodClamp overload
is out of scope. Motivation: OptiX HLSL uses separate samplers, and RT stages have no implicit derivatives.

**Why it parks.** The preferred fix is exactly what jkwak-work rejected on #13559
([discussion_r4273039653](https://github.com/shader-slang/slang/pull/13559#discussion_r4273039653)): *"I don't think
this is acceptable. We cannot just ignore the sampler when the user expect it to be used explicitly. I think we
should remove `cuda_` from the `require` line of this function"*. #13559 shipped with the separate-sampler form
pinned as E36107. The 13556 record already listed the `Sample`/`SampleLevel` sampler drop as a possible unfiled
follow-up; this issue files the inverse. Options for the maintainer: (A) extend the drop to SampleGrad (reverses the
#13559 ruling), (B) document the asymmetry (the issue's alternative), (C) make `Sample`/`SampleLevel` consistent
with the ruling (likely breaking for existing CUDA users).

**Routing (orchestrator, 2026-10-29 ~23:58Z).** `grep 14071 memory/slang/` had no hits. The only session on
`gh-issue-shader-slang/slang-14071` was my own Main webhook session `sess-1793318187530-57d4wk`. Dispatched to
slang-triager on that thread. **R6:** no labels, no crash word → no bot comment, PR, or issue-naming commit before
2026-11-02T23:56:25Z. No fixer dispatch.

**Triager interim (10-30 00:01Z, msg 10; the triager's finding, not yet verified by me).** Reproduced on master
1f0b33b86: separate-sampler `SampleGrad` → E36107 on ptx and cuda; separate-sampler `Sample`/`SampleLevel`/`Gather*`
drop `s`. Adjacent finding being checked: CUDA `GatherCmp` drops the compare value (a silent wrong result). I told
the triager to put it in the memo and not file it on its own; filing is my call after the memo.

**[Triage] (10-30 00:07Z, msg 12; memo `/workspace/inbox/a2a-1793318824179-dmq13q/triage-14071.md`).** feature-request /
low / P3 / CUDA target-emit + core module + docs. The E36107 is intentional per the #13559 ruling. Separate-sampler
overloads that drop `s` on CUDA: `Sample` (hlsl.meta.slang:2979), `SampleLevel` (:4221), all `Gather*` (:4996/:5043);
everything else (all 3 `SampleGrad`, `SampleBias`, `SampleCmp*`) is E36107. Docs: cuda-target.md:135 (from #13559) gives
the CUtexObject reason, which also applies to the overloads that compile; :20/:200 say "samplers are ignored"; :393 is
stale. Options A (reverse the ruling) / B (docs only, the triager's lean) / C (reject `s` everywhere, breaking ~10
in-tree tests). Correction to my dispatch: on #13559 the bot *stated* (r4273094495) that Sample/SampleLevel drop `s`;
it did not ask. Re-check **t-3160ea** fires 2026-11-03 00:10Z and posts `comment-14071.md` (+`reproduced`, Type=Feature
if still unset).

**Side findings in the CUDA Gather arm (hlsl.meta.slang:4966-5080), not #14071 scope.**
- F1: separate `GatherCmp` drops the compare value + comparison sampler (silent wrong result). ✅ **Main-verified 00:1xZ**
  at 1f0b33b868 Release: compare 0.75 and 0.125 both emit `tex2Dgather<float4>(dtex_0, uv.x, uv.y)`, rc=0.
- F2: combined `Sampler2D.Gather` on cuda → ICE E99997. ✅ **Main-verified**: assert at `slang-intrinsic-expand.cpp(370)`
  `(0 <= argIndex) && (argIndex < m_argCount)`, rc=255 (the triager said line 376).
- F3 (combined GatherCmp → invalid CUDA, rc=0) and F4 (Gather offset dropped): the triager's findings, not re-run by me.
- Overlap: bot draft #13741 (combined sampler in texture-only HLSL/Metal/WGSL ops) touches hlsl.meta.slang and
  slang-intrinsic-expand.cpp.
- **Decision (10-30 ~00:15Z):** filing a verified issue isn't gated (only ready, merge and close are; see
  [feedback leaf](../imported/feedback_github_writes_operator_authorized.md)), so I told the triager to file F1–F4 as **one
  bot issue**. It must not name #14071 before 11-02 23:56Z (R6 cross-reference); naming #13559/#13741 is fine. **Its
  `issue_opened` webhook belongs to this chain: dispatch nothing.** I'll decide on a fixer after its triage and the
  #13741 overlap check. I also asked for `comment-14071.md` so I can run an overstatement check before t-3160ea posts it.
- **Comment draft reviewed (10-30 00:1xZ, `/workspace/inbox/a2a-1793318922440-ingl4r/comment-14071.md`).** I checked
  the claims at 1f0b33b868: cuda-target.md:135 matches, and :20/:200 do say samplers are ignored. Edits sent: no-ping
  "jkwak-work" (not `@`); re-verify at that day's master before posting; link the F1–F4 issue and hedge (B), because
  `GatherCmp` also drops the compare value.
- **Filed as [#14073](https://github.com/shader-slang/slang/issues/14073)** (10-30 00:11:52Z, nv-slang-bot, labels
  `cuda`+`reproduced`, Type=Bug). Its body does not name #14071 (R6-safe); it names #12276/#13741/#13559 and includes the
  #13741 overlap run (ce23b34d9 gives the same results for items 1-3). Its `issue_opened` webhook arrived in a separate
  Main session `sess-1793319114390-v9wa9n` (thread `gh-issue-shader-slang/slang-14073`). Per the decision above, that
  session dispatched nothing. The triager's [Report] on #14073 reached chain session `sess-1793318187530-57d4wk` (seq 20),
  which owns the fixer decision. Bot-filed, so R6 does not hold #14073 itself.

**Spin-out filed: [#14073](https://github.com/shader-slang/slang/issues/14073) (10-30 00:13Z).** "CUDA/PTX:
`Sampler2D.Gather` crashes the compiler (E99997) and `GatherCmp` silently ignores the compare value". ✅ Main-verified
live: author nv-slang-bot, labels `cuda`+`reproduced`, 0 comments, the body does not mention 14071. **#14073 belongs to
this chain: its `issue_opened` webhook needs no dispatch.** The assert line is 376 on master; my local Release slangc
printed 370 because it's a stale binary, so trust 376. The triager checked #13741 (head fb36938e7) statically and with
a binary: no effect on F1–F3, only line-number shifts. Fix approach (triager): (1) `locationArg = isCombined ? "$1" :
"$2"` in the Gather template's CUDA arms (fixes F2/F3); (2) `GatherCmp*` → E36107 on CUDA, like `SampleCmp*` (fixes
F1/F3); (3) the dropped offset (F4) is a maintainer call, because :5055 drops it on purpose.
- **Decision (10-30 ~00:15Z):** dispatched slang-fixer on `gh-issue-shader-slang/slang-14073` for items 1+2 as a
  **draft** PR `Fixes #14073` (standing draft authority; bot-filed, so no R6). Label `pr: breaking change`, because
  item 2 turns code that compiles today into E36107. Item 3 is out. The PR must not name #14071 before 11-02 23:56Z.
  `t-3160ea` was updated with the comment edits; it still fires 11-03 00:10Z.
- **PR [#14079](https://github.com/shader-slang/slang/pull/14079) (10-30 ~01:19Z).** ✅ Main-verified live: draft, author
  nv-slang-bot, branch `fix/issue-14073`, head 2238323698, `Fixes #14073`, label `pr: breaking change`. No "14071" in the
  body, the commits or the 4 PR comments. 5 files: docs/cuda-target.md +2, hlsl.meta.slang +17/−4, 3 new tests. CI so
  far: 3 pass, 53 skipping. Explanation HTML is at
  `/workspace/inbox/a2a-1793323148544-ffb1g3/`. Waiting on the fixer's 5-bullet with test receipts.
- **Fixer [Report] (10-30 01:27Z, msg 32).** ✅ Main-verified live: head 37d46403f6, 4 commits, still draft; no "14071" in
  the body, commits or comments; no pending approvals. The following are the fixer's receipts, not re-run by me:
  - The 3 new tests pass 15/15 at head and 1/15 on master.
  - On the L40S, CUDA and Vulkan return the same 21 values.
  - Full slang-test at 2238323: 11324/11327 (3 fp8 coopmat failures, also on master).
  - In a 190-output Gather sweep, every non-CUDA output is byte-identical to master.
  - Bonus: combined `Gather(uv, offset)` used to take the offset as the location; the same fix corrects it.
  - The 5-part write-up is in explanation comment 6512543466 (the PR body is the hook-enforced short shape). F4 is a
    follow-up question there.
  - CI re-dispatch 40985513023 yielded at `wait-for-human-priority`. The fixer cancelled it so that
    `retry-yielded-bot-ci` reruns it.
  - Waiting on slang-reviewer (~90 min). Un-drafting is the operator's call.
- **slang-reviewer verdict (10-30 01:54Z, msg 36): APPROVE_WITH_NITS @37d4640, 0 bugs** (memo
  `/workspace/inbox/a2a-1793325251706-ru6aef/combined-review.md`; the remedy patch `remedy-14079-r1.patch` went to the
  fixer and passes 23/23 per the reviewer). Two disclosure gaps:
  - **G1:** the Gather offset is still dropped, and `Fixes #14073` would auto-close item 4. This is the #13556 lesson
    again. **My call: `Part of #14073`**, so F4 stays open on #14073 for the maintainer.
  - **G2:** `[CudaKernel]`/`[CudaDeviceExport]` roots skip the capability check. `GatherCmp` there now compiles to an
    empty body with rc=0, the same pre-existing hole `SampleCmp` has on master. **My call:** add the clause to the PR
    Risk line, and have the fixer file one bot follow-up after checking #13683 (specializeStageSwitch drops callees no
    entry point reaches; possibly the same mechanism).
  - Nits N1–N3 are in the patch; N4 (rename `locationArg`) is the fixer's choice. Un-drafting stays with the operator,
    and I ask once the remedy push lands.
- **G2 follow-up filed: [#14083](https://github.com/shader-slang/slang/issues/14083) (10-30 02:05:18Z).** "CUDA:
  [CudaKernel] and [CudaDeviceExport] functions skip capability checks, so unavailable intrinsics compile to an empty
  body". ✅ Main-verified live: author nv-slang-bot, label `cuda`, 0 comments, body does not name #14071 (R6-safe); it
  names #14079 and distinguishes #13683 (specializeStageSwitch, a different failure). Likely cause per the body:
  `validateEntryPointCapabilities` (slang-check-shader.cpp:1813) runs only for `EntryPoint` objects. **Owned by this
  chain: its `issue_opened` webhook (Main session `sess-1793325920758-x74cie`) dispatched nothing.** Triage/fix routing
  for #14083 is decided in chain session `sess-1793318187530-57d4wk`, after the #14079 remedy push.
- **Fixer [Fix Report] (10-30 02:41Z, msg 38).** ✅ Main-verified live:
  - PR: head e601ae75a6, 7 commits, still draft, `pr: breaking change`. The body says **`Part of #14073`** (no Fixes,
    Closes or Resolves) and cites #14083. "14071" appears nowhere.
  - **#14083** was filed by the bot ("CUDA: [CudaKernel] and [CudaDeviceExport] functions skip capability checks…",
    label `cuda`, no 14071 mention). It is not #13683: `validateEntryPointCapabilities`
    (slang-check-shader.cpp:1813) runs only for EntryPoint objects. **#14083 belongs to this chain; dispatch nothing on
    its `issue_opened`.**
  - Remedy patch applied unchanged. The fixer's receipts: 15/15 on the new tests, 24/24 with siblings, suite
    11324/11327 (fp8 failures, same as on master).
  - **CI has no build result.** The fixer cancelled two yielded runs (40985513023, 40991896824). ✅ I read the code:
    `retry-yielded-bot-ci.py` lists only completed runs and rejects any run with a cancelled non-marker job, so neither
    can be retried. I filed a shared learning on this. My call: the fixer does one fresh dispatch when no human or
    merge-queue CI is active, and does not cancel it. Un-drafting is the operator's call; asked on the dashboard
    10-30 ~02:45Z.
- **Fleet-wide bot-CI deadlock (fixer msg 42, 02:44Z; ✅ Main-verified 02:5xZ).**
  - `ACTIVE_STATUSES` (ci_priority_common.py:29) includes `waiting`, and `classify_blockers` yields to every active
    human run and every older bot run.
  - Live ci.yml runs at `waiting`: 41 human pull_request, 54 bot dispatch, 5 bot pull_request. The oldest bot one is
    39625672659 (10-21, fix/issue-13635); the oldest human one is 39764028477 (10-22).
  - The gate is `falcor-ci`, approved by `ci-approvers`, and `current_user_can_approve=false` for the bot.
  - This is the same mechanism as the 08-09 `_falcorDeadlock` in supervisor-state.json, now on a much larger set. No
    bot dispatch can produce builds until a ci-approvers member approves or rejects the waiting deployments, or the
    repo makes the gate and retry ignore runs parked on `pending_deployments`.
  - Decision: the fixer stays idle (a dispatch would only add one more stranded run). #14079 gets CI when the operator
    un-drafts it. Escalated on the dashboard thread `ci-falcor-gate-deadlock`.
