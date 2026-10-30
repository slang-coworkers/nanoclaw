---
type: chain
title: "slang#13685 / PR #13700 — all-undefined Texture2D phi → E56004"
description: Draft PR #13700 folds all-undefined block params; merge blocked on pdeayton-nv's R2/R8 decision since 2026-10-17.
tags: [slang, ir, peephole, phi, undefined, E56004, pdeayton-nv]
---

# slang#13685 → draft PR #13700

- **Issue:** a conditional struct assignment whose texture field is never written fails with E56004 on SPIR-V.
  Filed by pdeayton-nv, who on 2026-10-16 asked the bot to triage it and open a draft PR.
- **Thread:** `gh-issue-shader-slang/slang-13685`. Triage comment: issuecomment-6210256165.
  Owner sessions: slang-fixer `sess-1792135091874-yiuh5a`, slang-triager `sess-1792133894274-zulqif`.
- **Fix:** a peephole fold of a `kIROp_Param` whose incoming values are all undefined. pdeayton-nv
  redesigned it twice: in issuecomment-6220753266 (correlation and loop stability, the fresh value in
  the entry block) and in round 4, 6228037888 (refine only to non-poison values).
  At R4 (head 9df4eb585f), slang-reviewer gave APPROVE_WITH_NITS, and all the nits were applied.
- **Follow-ups filed:** #13702 (GLSL/WGSL invalid code for an undefined texture),
  #13727 (prelinking correlation). Both bugs are also on master.
- **Merge blocker:** R2/R8 (issuecomment-6227965371). pdeayton-nv must choose between
  option 1 (keep correlation, which regresses a loop shape that master compiles) and
  option 2 (forward as master does). Unanswered since 2026-10-17T01:29Z.
- **2026-10-29:** pdeayton-nv asked "please rebase against ToT" (6505752605). The fixer merged
  master instead (dc9ed5b41, no force-push) and offered a literal rebase. I asked it to restate R8
  in its post-merge comment.
- **2026-10-29 19:51Z:** the merged head **dc9ed5b417** is pushed (CI run 40942161484) and is MERGEABLE.
  The fixer found (not yet verified by me) that master's SPIRV-Tools bump (#13963) makes spirv-val reject
  `OpUndef` of an image type (`VUID-StandaloneSpirv-OpUndef-12464`). The fold produces exactly that,
  so 6 PR SPIR-V runs and the issue repro now fail validation. A lone never-written texture
  hits the same rule on master. The suite is 11312/11321 (those 6 + 3 fp8 CUDA). Two decisions are now with
  pdeayton-nv in issuecomment-6506798882: how to handle the VU (fixer's lean: a pre-emit pass that
  removes uses of undefined opaque handles), and R8 (asked again there).
- **2026-10-29 21:47Z:** pdeayton-nv answered Q1 in 6509087225: "please create a new issue for resolving
  the `OpUndef %image` problem and work on a fix, taking care with the freeze semantics." slang-fixer acked (6509101164)
  and **owns the new bot-filed issue and its draft PR from this #13685 session** (worktree `wt-slang-undef-image`).
  ⇒ When that issue's `issue_opened` webhook arrives (author nv-slang-bot, about OpUndef of an image / freeze), do **not**
  dispatch it to a triager. Record the number here. R8 (Q2) is still unanswered.
- **2026-10-30 00:28Z:** that issue is **#14076** (bot-filed, linked on #13700 in 6511830817). The fixer confirmed it on
  clean master 977df1246: 6 of 8 probes fail OpUndef-12464. It owns the fix on `fix/issue-14076` (worktree
  `wt-slang-undef-image`) from session `sess-1792135091874-yiuh5a`. **#14076 webhooks need no dispatch.** Its
  `issue_opened` reached me 10-30 and was not dispatched. It is bot-filed, so no R6 hold applies.

## Lesson: re-check prompts must test the specific decision

My 2026-10-17 one-shot re-check (`recheck-slang-13700-main-9dbe`, fired 10-19) had this step 2:
"if pdeayton-nv has replied and slang-fixer has acted → silent". The maintainer's 01:37Z round-4
review (a different topic) satisfied that step, so R8 went 12 days with no operator reminder.
A re-check prompt for a parked decision names the exact question comment and asks
"is THIS question answered?". Any maintainer reply is not enough.
- **2026-10-30 01:56Z:** the fixer opened **draft PR #14081** ("SPIR-V: remove uses of undefined opaque handles
  instead of emitting OpUndef of an image", `Fixes #14076`) on `fix/issue-14076` @`c1b0664ec`. It is mapped to session
  `yiuh5a` on thread `gh-issue-shader-slang/slang-13685`, so its webhooks route there. The PR adds a pre-emit SPIR-V pass with one
  freeze choice per handle. Tests: `tests/spirv/undefined-opaque-handle*.slang` (11 shapes, vk on L40S) plus a
  noinline diagnostic test. The explanation comment was posted 01:57Z; the fixer sent me its HTML (inbox
  `a2a-1793325497786-mg4n4c`), which needs no action. #13700 still waits on #14081 and on R8.
- **2026-10-30 02:04Z, fixer report (I checked live):** #14081 is labeled `pr: non-breaking`. CI dispatch
  40988792961 @c1b0664 is a `workflow_dispatch`, `waiting` at 02:04Z; on a draft it may yield. The #14076 status
  comment was posted 02:03Z. Fixer's figures: 15 new runs that each fail without the fix, and a full suite of 11324/11327
  (only the 3 fp8 CUDA failures, as on master). Peer review was sent to slang-reviewer on the #13685 thread. **Open for the
  reviewer/maintainer:** E56003 for a handle that survives into a `[noinline]` callee (it used to produce an invalid
  module). Does that still count as `pr: non-breaking`? That is a maintainer call, not mine.
- **2026-10-30 02:57Z:** slang-reviewer R1 of #14081 @c1b0664ec is **REQUEST_CHANGES**. 1 bug: an `ImageStore` through
  an undefined handle in an inlined callee is fatal E56003. Gaps: latent recursion non-termination; test runs `.9`/`.10`
  pass on base unless spirv-val is on; an untested forwarding path that users can reach. Maintainer R1–R3 met;
  `pr: non-breaking` OK. Open for pdeayton-nv: reads through an undefined handle are not correlated (two loads give two
  OpUndef). The reviewer says this is sound because access through an unwritten descriptor is UB, but the maintainer should confirm.
  Next: the fixer's R2. The combined review is in inbox `a2a-1793329070807-xwu2qx`.
