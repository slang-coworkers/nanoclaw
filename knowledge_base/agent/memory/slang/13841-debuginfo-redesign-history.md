---
type: chain-log
title: "slang#13841 — dated history: the #14106 debug-info redesign and phase-1 PR #14114 (10-30 →)"
description: "Dated readings from 10-30 21:23Z on: pdeayton-nv's ask for a tracking issue + draft, #14106 filed with a 3-phase plan, phase-1 draft #14114 (budget stop at ~$265/$300), slang-reviewer R1 REQUEST_CHANGES (L1-L3, not posted), the #13842 re-check and gaps A/B, the 11-05 stable-id shift, and tangent-vector's first inline review (11-06). New dated entries append here."
tags: [slang, spirv, debug-info, nsdi, redesign]
---

# slang#13841 — dated history: the #14106 redesign and PR #14114

Chain record (state, repro, collision, pending actions): [[slang/13841-debug-declare-real-storage.md]]. The earlier PR #13872
phase is in [[slang/13841-pr13872-history.md]]. New dated entries go **here**.

**10-30 21:23–21:26Z:** pdeayton-nv asked the bot to "track the redesign in a new issue and come up with a draft PR" and to keep #13872 open. I scoped the fixer: (1) tracking issue quoting tangent-vector's model, no @; (2) phased plan on that issue; (3) phase-1-only draft (`DebugDeclare` at lowering, plus SSA promotion to `DebugValue`); (4) stop and report by about $280. The fixer was at $198.51/$300 and acked. I told the operator a ceiling raise is needed for the full redesign.
**10-30 21:40Z — tracking issue #14106 filed** by fixer `efb8e6` (step 1 of the 21:26Z scope): "Encode variable debug info in Slang IR as a near one-to-one analog of SPIR-V NSDI". It quotes tangent-vector's model from cmt 6530975517 and says a phased plan follows in a comment. No labels or comments yet. Bot-filed, so the R6 hold does not apply. **This chain owns #14106. Its `issue_opened` webhook needs no dispatch** (checked 21:4xZ: the only other session on `gh-issue-shader-slang/slang-14106` is the Main webhook session `5q3ifi`). Next from the fixer: the plan comment, then the phase-1 draft PR, then a report by about $280.
**10-30 22:10Z:** tracking issue **#14106** is filed with the 3-phase plan (cmt 6534546653), linked from #13872 (cmt 6534550940, which notifies tangent-vector because he's a #13872 participant). There are no @-mentions; codex wanted @tangent-vector and the fixer declined. A phase-1 subagent is implementing on `fix/issue-14106` (`wt-slang-debuginfo`), with a budget timer every 25 min. Merge risk Q1: at -O1, spirv-opt may lose member values of unpromoted struct locals.
**10-31 00:51Z, phase-1 draft #14114** at `f2779c645` (#14106, `pr: non-breaking`, no closing keyword, mapped to efb8e6). The fixer stopped for budget at $264.58/$300. NOT mergeable yet: 3 deliberate new failures (-O1/-O2 spirv-opt splits struct locals into OpUndef), an autodiff -g2 assert, texture-footprint over 900 s at -g2 -O1, LLVM dropping inout declares, and an inlined inout in a merge block with no initial DebugValue. Waiting on tangent-vector's Q1–Q3 on #14106 and the slang-reviewer verdict. A fix round needs a ceiling raise on efb8e6 (one owner per PR, so no fresh session).
**10-31 01:54Z, slang-reviewer interim on #14114:** C (clarity) is done. A second sweep over 3415 configs found no new head-only failures beyond the two disclosed issues. A (correctness) is still pending, with the full slang-test suite running on head. No reply sent; the verdict comes next.
**10-31 02:10Z, slang-reviewer interim 2 on #14114:** A (correctness) is done: 0 bugs, 6 gaps, drift 0. The full suite on head is 11115/11121, the same 6 failures the fixer reported. A's quadratic-DebugValue gap was measured at 34009 vs 1283 OpDebugValue for 256 inlined inout calls. The reviewer is building a small tested remedy for the dropped-declare / unwritten `_dbgvar_` and the E40007 finding, then sends the combined report. No reply sent. (02:16Z correction from the reviewer: the E40007 retarget comes from `specializeFuncsForBufferLoadArgs`, a pass the PR does not touch, not from copy elimination; the remedy moves there.)
**10-31 02:26Z, #14114 R1 combined review (slang-reviewer) at `f2779c645`: REQUEST_CHANGES**, which is expected for a design draft. It was not posted to GitHub. The findings:
- L1 🔴: `specializeFuncsForBufferLoadArgs` and `moveDebugDeclaresAfterStore` retarget a declare onto a `ConstantBuffer`, giving E40007, and the `_dbgvar_` is never written. The reviewer attached a tested remedy: 3 files, +41/−5, plus `tests/spirv/debug-declare-dropped.slang`.
- L2 🟡: the inliner makes the `DebugValue` count quadratic (34009 vs 1283 at N=256). This is NOT the cause of the footprint timeout.
- L3 🟡: DCE treats the declare as a use, so `-g2` keeps dead locals in HLSL/GLSL.
- L4: the disclosed regressions are confirmed head-only.
- Requirements: M3 and M4 are partial (phase 1). M1, M5 and M6 are deferred and still unconfirmed by tangent-vector.

The fixer saved the review to `reports/debuginfo-redesign/r1/` and **parked**. It is at $267.12 of $300 (status escalated). The fix round (L1, then L3, then L2) needs the operator to raise the ceiling, and Q1–Q3 on #14106 are still unanswered. Shepherd for #14114 is jkwak-work (auto-assigned). I asked the operator for the ceiling decision at 02:29Z (msg 509617), recommending about $400. If approved, I run `ncl cost-cap set-ceiling --session sess-1792627891313-efb8e6 --ceiling 400` and send the fixer a go-ahead on thread gh-issue-shader-slang/slang-13841. The reviewer sent its verdict twice (509614 and 509616, identical).
**10-31 16:10Z, #13842 re-check `t-2a6862` (triager, Branch 3, nothing posted):** I verified it on GitHub: bot comment 6329267840 is still the newest on #13842, #14114 is a draft at `f2779c645`, and #13872 is a draft at `70cb286`. The triager says #13842 is now tracked by #14106, which names it as a symptom. The triager's local finding (#14114 vs master `d7bc9fb0c`, -g2): phase 1 removes the overlap for aggregates only (`arr`, `s`). Scalars and params (`x`, `i`, `tid`) still overlap at -O0, the -O1 ADCE doubling is unchanged, and phase 2 is what closes #13842. **Two #14114 gaps that are not in its known-gaps table (the triager's finding, not yet verified):** (a) at -O1, the DebugValue for a re-read scalar is `OpUndef` (`x` in a merge block before `outBuf[1]=x`; `i` in the loop header); (b) at -O0, those re-loads get an extra DebugValue. **Queued with me, not sent:** fixer efb8e6 is escalated ($267.20/$300, container stopped) and the operator has not answered the 02:29Z ceiling ask (msg 509617). Put (a) and (b) in the efb8e6 go-ahead, after L1/L3/L2, labelled as the triager's finding. I approved the in-place edit of 6329267840 with constraints: no claim that #5398 is answered (the #14106 plan is still a proposal; Q1–Q3 are open), the issue stays open, no closing keyword, no @-mentions, and the #14114 gaps go on the PR chain, not on #13842. The triager will persist the repro outside `/tmp` and send it inline. Next one-shot: `t-47f371`, 11-14 16:00Z.
**10-31 16:17Z, #13842 comment 6329267840 edited in place (triager; I checked it live at 16:17:03Z, and it is still the only comment).** It now says #13842 is tracked by #14106 and partly addressed by #14114 (aggregates only), that phase 2 is the remaining step, and that the plan is still unconfirmed (open question 2 is #13842's question). It has no @-mentions and no closing keyword. The repro and gaps A/B for the efb8e6 go-ahead are in the chain record.
**11-02 18:55Z — jhelferty-nv assigned #14106 to pdeayton-nv** and asked them (cmt 6585610084): "@pdeayton-nv It looks like this was raised by the bot off of some of the work you did?" It came in as a `pr_mention` webhook, but it does not mention @nv-slang-bot. The question is addressed to pdeayton-nv, so **no bot reply and no dispatch**. The issue body already links the #13872 comments that requested it. Checked live at 18:56Z: #14106 has 3 comments (the bot plan 6534546653, the bot phase-1 note 6536769653, and jhelferty's). #14114 is still a draft at `f2779c645` with 0 reviews. efb8e6 is still `escalated` at $267.20/$300, so the ceiling ask (10-31 02:29Z) is still open.

**11-05 ~09:10Z, the collision set changed under the drafts:** master #14051 (merged 11-04) took stable ids **911/912** and set module version
**min=max=38**. Master's ids are now 909, 911, 912; **910 is still free**, but four drafts claim it: #13564, #13872, #14114 and #13425.
A plain master merge **auto-merges `k_maxSupportedModuleVersion` to 38, silently reusing v38** for a different format change. So every one of
these drafts needs **v39** (and the next free id) at its next rebase. The PR Risk lines already say "next free id + the version that follows
master's"; the #13425 re-chase caught it as collision 5. #13953 claims v38 only, no id, and it needs v39 too.
**11-05 10:02Z:** #13564 merged master again (head `a4e7e33342`) and now takes **913 / v39**, so it's out of the 910 set. Still claiming 910/v38: #13872, #14114, #13425, plus #13953 on v38 only.
**11-06 17:47–17:50Z: tangent-vector is reviewing #14114 inline. It is the first maintainer review. 3 COMMENTED
reviews so far (r4495734714, r4495749319, r4495760218), all clarity asks: state the problem, constraints and strategy,
and explain each early-out.** The fixer (efb8e6, $269.44/$300, escalated) proposed ONE batched acknowledgment once
the batch settles. I approved it: no per-comment replies, no push, no CI, then park, keeping $10 in reserve (511605).
**I asked the operator again for the ceiling** (511607): the maintainer review is a new fact. I recommended $400 and
gave the reply keyword "raise 14114". On "raise 14114", run
`ncl cost-cap set-ceiling --session sess-1792627891313-efb8e6 --ceiling 400`, then send the go-ahead on
gh-issue-shader-slang/slang-13841 (in_reply_to the fixer's row). Fix-round order: tangent-vector's comments, L1/L3/L2,
then the triager's gaps (a)/(b), pasting the repro from the 10-31 16:17Z entry inline.
**11-06 18:32Z: the fixer posted the acknowledgment and parked. I checked both posts live: bot-authored, no @-mentions, head still `f2779c645`, still a draft.**
The review now has **17 inline comments from tangent-vector and 1 from pdeayton-nv**. The consolidated ack is
[6692400190](https://github.com/shader-slang/slang/pull/14114#issuecomment-6692400190); it lists 16 items, and later
comments go into the same round. Most items are clarity asks. Two are structural:
- one `List<DebugDeclareInfo>` instead of two containers;
- a `dominates` helper with a stated contract.

pdeayton-nv added a requirement: `DebugDeclare` must come before any store that references it, as glslang does.
tangent-vector asked whether skipping pair/tuple/implicitDeref is a scope limit or corner-cutting. The fixer answered
in thread [r4496154889](https://github.com/shader-slang/slang/pull/14114#discussion_r4496154889) with two options for
them to pick, so the round may have to wait for that answer. The fixer has $23.1 left and keeps a $10 reserve. Its
worktree was reaped; it is recreated from origin/fix/issue-14106. I am still waiting on "raise 14114" (511607) and
will not re-ask.
