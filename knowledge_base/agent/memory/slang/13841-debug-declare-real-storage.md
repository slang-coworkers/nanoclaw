---
type: chain
title: slang#13841 — SPIR-V DebugDeclare should name the variable's real storage
description: "slang-fixer efb8e6 / triager 2zq0tf. Draft PR #13872 (DebugVarStorage) stays open, but tangent-vector rejected its design 10-30 and wants an IR debug-info redesign, tracked by bot-filed #14106. Phase-1 draft #14114 @f2779c645 is under its first maintainer review (11-06). Fixer efb8e6 is escalated near its $300 ceiling; the operator ceiling ask ('raise 14114', $400) is open. Stable id 910 / module v38 are claimed by several drafts, which all need the next free id + v39 at rebase."
tags: [slang, spirv, debug-info, stable-names, module-version]
---

# slang#13841 — DebugDeclare on real storage

Dated history: PR #13872 phase (10-22 → 10-30) in [[slang/13841-pr13872-history.md]]; the #14106 redesign and PR #14114
(10-30 →) in [[slang/13841-debuginfo-redesign-history.md]]. New dated entries go to the redesign log, not here.

## Current state (11-06 18:32Z)

| item | state |
|---|---|
| #13841 | OPEN. Triage resolved (fixed) 10-23 in bot comment 6345766573. |
| PR #13872 | DRAFT @`70cb286`, kept open at pdeayton-nv's request. Design rejected 10-30 by tangent-vector (cmt 6530975517: `DebugVarStorage` is a band-aid; he wants IR `DebugDeclare` at lowering, every pass maintaining debug insts, close to 1:1 with SPIR-V NSDI). |
| #14106 | Bot-filed tracking issue, **owned by this chain** (issue_opened needs no dispatch). 3-phase plan in cmt 6534546653; Q1–Q3 to tangent-vector unanswered. Assigned to pdeayton-nv 11-02; jhelferty-nv's question there (6585610084) was to pdeayton-nv, so no bot reply. |
| PR #14114 | Phase-1 draft @`f2779c645` (`pr: non-breaking`, no closing keyword, mapped to efb8e6, shepherd jkwak-work). Not mergeable: deliberate -O1/-O2 failures and other disclosed gaps (redesign log, 10-31 00:51Z). slang-reviewer R1 REQUEST_CHANGES (L1 🔴, L2/L3 🟡), not posted. **First maintainer review 11-06:** 17 inline from tangent-vector, 1 from pdeayton-nv; batched ack [6692400190](https://github.com/shader-slang/slang/pull/14114#issuecomment-6692400190); a scope question (skipping pair/tuple/implicitDeref) waits on their pick in [r4496154889](https://github.com/shader-slang/slang/pull/14114#discussion_r4496154889). Worktree reaped; recreate from origin/fix/issue-14106. |
| #13842 | Tracked by #14106 as a symptom; phase 2 closes it. Bot comment 6329267840 edited 10-31. Next one-shot: triager `t-47f371`, 11-14 16:00Z. |
| fixer efb8e6 | `sess-1792627891313-efb8e6`, escalated ($269.44/$300 on 11-06, keeping a $10 reserve). Ceiling ask open: msg 509617 (10-31), re-asked 511607 (11-06) with keyword "raise 14114", $400 recommended. **Do not re-ask.** |

## On "raise 14114"

Run `ncl cost-cap set-ceiling --session sess-1792627891313-efb8e6 --ceiling 400`, then send the go-ahead on
gh-issue-shader-slang/slang-13841 (in_reply_to the fixer's row). Fix-round order:
1. tangent-vector's comments, including one `List<DebugDeclareInfo>` instead of two containers, a `dominates` helper with a stated
   contract, and pdeayton-nv's requirement that `DebugDeclare` comes before any store that references it (as glslang does);
2. reviewer findings L1, then L3, then L2;
3. the triager's gaps A/B below, labelled as the triager's finding, with the repro pasted inline (it lives in the triager's
   group folder `scratch-13842/m14114-2026-10-31/`, which the fixer can't read).

```
RWStructuredBuffer<float> outBuf;
[shader("compute")][numthreads(1,1,1)]
void main(uint3 tid : SV_DispatchThreadID) {
    float x = outBuf[0]; x = x * 2.0;
    if (tid.x > 3) x = x + 1.0;
    outBuf[1] = x; }
// SLANG_RUN_SPIRV_VALIDATION=1 slangc repro.slang -target spirv-asm -entry main -stage compute -g2 -O0|-O1
```
- Gap B (-O0), merge block: #14114 adds `OpLoad %x` → `DebugValue %x_0` → `OpStore %_dbgvar_x`, and master has none of these. The same happens for `i` in the loop header (repro-arr, `for (int i=0;i<4;i++)`).
- Gap A (-O1), same spot: it emits `DebugValue %x_0 %OpUndef` right before `outBuf[1]=x`. For `i` it emits `DebugValue %i_0 %OpUndef` after `OpLoopMerge`.
- The triager's unverified hypothesis is that gap A comes from gap B. Phase 1 emits a DebugValue at a surviving phi, which at -O0 is a re-load. ADCE then deletes that load, because its only users are debug ones, and the operand becomes OpUndef.

## Stable id 910 / module version collision (11-05)

Master #14051 (merged 11-04) took stable ids **911/912** and set module version **min=max=38**, so master has 909, 911, 912, and
**910 is still free**. #13564 moved to **913 / v39** on 11-05 and left the set. Still claiming 910/v38: #13872, #14114 and #13425;
#13953 claims v38 only. **A plain master merge auto-merges `k_maxSupportedModuleVersion` to 38, silently reusing v38** for a
different format change, so each of these drafts needs the next free id and **v39** at its next rebase. The PR Risk lines already
say "next free id + the version that follows master's".

## Lessons

- **Messaging a fixer directly skips the triager tier**, so its report-up drifts to Main (twice on 10-23). Send cross-chain
  heads-ups through the chain's triager.
- A webhook that is a question to a human, with no @nv-slang-bot, gets no bot reply and no dispatch.
- One owner per PR: a fix round on #14114 needs a ceiling raise on efb8e6, never a fresh session.
**11-08 09:04Z (per the #13425 re-chase; I have not re-checked):** stable id **910 is now taken on master.** Our own Metal
fence PR #13792 (`286cdeee49`, 11-06) took 910 and set max = 39. Then #14360 (`ae4e57957a`) set **min = max = 40**. So
every draft still claiming 910 or v38/v39 must renumber at its next master merge: #13872, #14114, #13425 (conflicting
now) and #13953. Before giving any of them a "merge master" go-ahead, have the fixer take the next free id after
master's highest and set min = max to 41 (or whatever master's max + 1 is at that point).
