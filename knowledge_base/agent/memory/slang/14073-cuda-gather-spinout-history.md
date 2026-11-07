---
type: chain-log
title: "slang#14073 — CUDA Gather spin-out of #14071: dated history (terminal)"
description: "Bot-filed 10-30 from the #14071 triage side findings F1–F4 (CUDA Gather arm). Items 1–3 merged in PR #14079 (9b46bca644, 11-02); item 4 (offset → E36107, jkwak-work option (a)) merged in PR #14388 (b85caf9285, 11-06); issue CLOSED 11-06 21:18Z. Terminal; owned by the #14071 chain."
tags: [cuda, texture, gather, spin-out, terminal]
---

# slang#14073 — CUDA Gather spin-out: dated history (terminal)

Split out of [[slang/14071-cuda-separate-sampler-history.md]] on 2026-11-07, when that log passed 16 KB. Current state and
lessons: [[slang/14071-cuda-separate-sampler-samplegrad.md]]. **#14073 is CLOSED; append nothing unless a maintainer reopens it.**
The #14083 (G2) entries stay in the #14071 log, because #14083 is still parked with that chain.
Numbers are the coworker's own unless marked ✅ Main-verified.

## Side findings F1–F4 and the decision to file (10-30)

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

## #14073 filed and PR #14079 (10-30)

**Spin-out filed: [#14073](https://github.com/shader-slang/slang/issues/14073) (10-30 00:13Z).** "CUDA/PTX:
`Sampler2D.Gather` crashes the compiler (E99997) and `GatherCmp` silently ignores the compare value". ✅ Main-verified
live: author nv-slang-bot, labels `cuda`+`reproduced`, 0 comments, the body does not mention 14071 (R6-safe; it names
#12276/#13741/#13559). Its `issue_opened` webhook landed in Main session `sess-1793319114390-v9wa9n`, which dispatched
nothing (owned by this chain). The assert line is 376 on master; my local Release slangc
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
- **G2 follow-up filed as #14083 (10-30 02:05Z)**; its entries are in the #14071 log.
- **Fixer [Fix Report] (10-30 02:41Z, msg 38).** ✅ Main-verified live:
  - PR: head e601ae75a6, 7 commits, still draft, `pr: breaking change`. The body says **`Part of #14073`** (no Fixes,
    Closes or Resolves) and cites #14083. "14071" appears nowhere.
  - Remedy patch applied unchanged. The fixer's receipts: 15/15 on the new tests, 24/24 with siblings, suite
    11324/11327 (fp8 failures, same as on master).
  - **CI has no build result.** The fixer cancelled two yielded runs (40985513023, 40991896824). ✅ I read the code:
    `retry-yielded-bot-ci.py` lists only completed runs and rejects any run with a cancelled non-marker job, so neither
    can be retried. I filed a shared learning on this. My call: the fixer does one fresh dispatch when no human or
    merge-queue CI is active, and does not cancel it. Un-drafting is the operator's call; asked on the dashboard
    10-30 ~02:45Z.
- **Fleet-wide bot-CI deadlock (fixer msg 42, 02:44Z; ✅ Main-verified 02:5xZ).** `ACTIVE_STATUSES`
  (ci_priority_common.py:29) includes `waiting`, and `classify_blockers` yields to every active human run and every older
  bot run. ~100 ci.yml runs sat at `waiting` on the `falcor-ci` gate (approved by `ci-approvers`;
  `current_user_can_approve=false` for the bot), the same mechanism as the 08-09 `_falcorDeadlock` in supervisor-state.json.
  Decision: the fixer stays idle; #14079 gets CI when the operator un-drafts it. Escalated on dashboard thread
  `ci-falcor-gate-deadlock`.

## Approval and merge of #14079 (11-02)

**11-02 17:4xZ: #14079 approved and out of draft (fixer msg 56; ✅ Main-verified live).** The operator un-drafted it.
jkwak-work APPROVED at 17:43:28Z ("Looks good to me"). Head is still e601ae75a6, mergeState BEHIND (15 commits; the
fixer says `git merge-tree` is clean). `pull_request` CI 41493865345 is queued. My call: **no master merge push**,
because a push could dismiss the approval and restart CI, while pull_request CI already builds the merge ref and the
merge queue handles BEHIND. Enqueueing or merging belongs to the maintainer/operator. #14073 stays open for F4.

**11-02 21:21Z: #14079 MERGED (✅ Main-verified live).** jkwak-work merged it as `9b46bca644` (from head e601ae75a6)
after pull_request CI 41493865345 passed. The fixer cleaned up its worktree. **jkwak-work is now assigned #14071,
#14073 and #14083**, all OPEN with 0 comments. #14073 stays open for F4 (the offset). I asked the fixer for one
5-bullet on #14073 (items 1–3 merged, item 4 awaiting the maintainer). #14083 is parked with jkwak-work, and no bot
fixer is on it. #14071 is unchanged: t-3160ea posts 11-03 00:10Z.
- **11-02 21:27Z:** the fixer posted the #14073 status 5-bullet,
  [6588878093](https://github.com/shader-slang/slang/issues/14073#issuecomment-6588878093), and went idle. Correction to
  my brief: not every CUDA offset overload is E36107. `Load(location, offset)` supports CUDA and applies the offset
  (hlsl.meta.slang ~:5380); only `Sample*` leaves CUDA out. #14073 is parked with jkwak-work for F4.

## Item 4 (offset) and PR #14388 (11-06)

**11-06 17:26Z: jkwak-work decided #14073 F4: option (a)** ([6691067713](https://github.com/shader-slang/slang/issues/14073#issuecomment-6691067713)):
"We should make it a capability error; in other words, we should go with option A", plus updating docs/cuda-target.md (the
quoted :139 sentence). No @nv-slang-bot mention. The webhook (pr_mention, is_pr=false) landed in Main session
`sess-1793319114390-v9wa9n` (the 14073 thread; chain session 57d4wk was stopped). ✅ Main-verified on master fef74e3c67:
the offset overload still has `[require($(gatherTargets), texture_gather)]` and a CUDA arm that drops `offset`
(hlsl.meta.slang ~:5055-5075). **Dispatched slang-fixer 17:28Z**, pinned to owner `sess-1793319286053-9p0eqs`
(`thread_id` gh-issue-…-14073, `in_reply_to=10` = my webhook row). It landed at seq 40 with no phantom session. Ask: a
draft `Fixes #14073` PR (the last item), `pr: breaking change`, docs :139 rewrite, update
texture-2d-gather-element-type.slang, E36107 offset coverage, then one 5-bullet on #14073. #14083/#14071 out of scope.
- **11-06 18:06Z: draft [#14388](https://github.com/shader-slang/slang/pull/14388) opened** (✅ Main-verified live): head
  a8afe828c2. The branch is `fix/issue-14073-gather-offset`, chosen as option (2) so that nothing was force-pushed over the
  merged `fix/issue-14073` (e601ae75a); I confirmed that choice to the fixer at msg 25. Body `Fixes #14073`, no "14071", no @. Label `pr: breaking change`. pr-mapping →
  9p0eqs. Files: hlsl.meta.slang +4/-10, cuda-target.md +1/-1, new tests/diagnostics/cuda-gather-offset-unsupported.slang,
  edits to texture-2d-gather-combined-cuda.slang and texture-2d-gather-element-type.slang. Explain-diff comment
  6691891271 posted. No 5-bullet on #14073 yet at 18:07Z (the fixer's [Report] has not arrived).
- **11-06 18:10Z fixer [Report] (msg 30):** the 5-bullet on #14073 is posted,
  [6691956936](https://github.com/shader-slang/slang/issues/14073#issuecomment-6691956936) (✅ Main-verified: bot author,
  no @, no "14071"). The fixer's figures: new diagnostic test 6/6 (0/6 on master); full slang-test 11851/11854, where the 3
  fp8-cuda failures also fail on master; 190/190 non-CUDA outputs byte-identical. The offset overload is now
  `[require(glsl_hlsl_metal_spirv_wgsl, texture_gather)]`. slang-reviewer peer review requested; the `[Fix Report]` follows
  its verdict. No CI dispatched while draft (falcor-ci rule, 10-30).
- **11-06 18:17Z: jkwak-work un-drafted #14388 (18:17:36Z) and APPROVED it (18:17:54Z, "Looks good to me")** (✅ Main-verified).
  Head a8afe828c2, mergeState BLOCKED on required checks, pull_request CI 42269369348 queued. I told the fixer (msg 33)
  to hold the head: reviewer nits are deferred into its [Fix Report], a correctness or CI code failure comes to me
  before any push, and there is no master-merge push on BEHIND. Merging belongs to the maintainer/operator.

**11-06 18:34Z: slang-reviewer verdict on #14388 @a8afe82: APPROVE_WITH_NITS, 0 bugs** (arrived in the #14071 Main
session `57d4wk`; memo `/workspace/inbox/a2a-1793990052407-bk1yvx/combined-review.md`). Both of jkwak-work's asks are met
(option A, docs). Gaps: the four-offset E36107 has no test (the reviewer's patch adds rows), and the Risk line should name
#14083 (offset Gather now truncates `[CudaKernel]` bodies, as `SampleLevel` with an offset already does on master).
The patch went to the fixer directly. At 18:19Z the sibling Main session `v9wa9n` had already told the fixer to keep
head a8afe828c2 now that it's approved, and to record nits as deferred with no push. Both gaps are nits, so I sent no
second instruction: one Main voice per chain.

**11-06 18:40Z fixer [Fix Report] (msg 34, to Main session `v9wa9n`).** Head still a8afe828c2, no push since approval.
slang-reviewer APPROVE_WITH_NITS, 0 bugs. G1 (no four-offset CUDA test row) and N1/N2 (comment scoping) were deferred and are
kept in `remedy-14388-r1.patch`, with no follow-up PR unless a maintainer asks. G2 was applied as a PR-body Risk line naming
#14083, which moved no code. The #14083 side find it raised is in the #14071 log.

**11-06 21:18Z: #14388 MERGED by jkwak-work as `b85caf9285`** (from a8afe828c2, after CI 42269369348 passed). **#14073 CLOSED
(completed)** at 21:18:47Z (✅ Main-verified live). Items 1–3 shipped in #14079 and item 4 in #14388. The fixer removed the
worktree and kept `remedy-14388-r1.patch` (G1/N1/N2), with no follow-up unless a maintainer asks. The #14073 spin-out is
terminal; #14071 (A/B/C) and #14083 remain parked with jkwak-work.
