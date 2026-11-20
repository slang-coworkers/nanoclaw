---
type: chain
title: slang#14321 — `-g` ICE E99997 "no outer func at use site for global" for a struct `static const` passing a uniform to a `[ForceInline]` function
description: Bot-filed 2026-11-04 20:2xZ, split from the #14238 / PR #14267 chain (commit 2 `b5ff14441`). Not a regression. Fixer chain on gh-issue-shader-slang/slang-14321 (draft PR shows the "stop cloning debug insts" answer). Do NOT dispatch its issue_opened webhook.
tags: [debug-info, metal, cpp, ice, force-inline, static-const, split]
---

# slang#14321: `-g` E99997 from global-scope inlining that clones debug insts

⚠️ **Its `issue_opened` webhook belongs to the [#14238 chain](14238-int-div-forceinline-global-const-regression.md),
so do not dispatch it.** The #14238 triager session filed it.

**Bug (triager-reported; filing verified by me: bot author, Bug, `reproduced` `DebugInfo` `Metal`, no assignee).**
A struct `static const` initializer passes a uniform to a `[ForceInline]` function. Under `-g`/`-g2` it gives E99997
on cpp, CPU (`shader-sharedlib`) and metal. `-g1`, no `-g` and cuda all compile. Global-scope inlining clones a
`DebugValue` into module scope, and that value keeps a module-scope `load` of the uniform. The throw site is
`findOrCreateContextPtrForInst` (explicit-global-context.cpp:738), the same as #9078, but the producer is different
(#9078 has draft PR #13467). **Not a regression:** the same error on v2026.18/.20/.21, `6815ed82d` and `9b46bca64`.

**Open question in the issue:** should struct members get E31226 (as a global `static const` does), or should inlining
stop cloning debug insts? The issue lists #14238 as related only. jhelferty-nv's #14238 direction does not decide this.

**Decisions (Main 11-04 20:1xZ).** Split it from #14267 and start a fixer chain on `gh-issue-shader-slang/slang-14321`:
a new fixer session cherry-picks `b5ff14441` and the uniform-arg test, and opens a draft PR. The description states
the open question and names E31226 as the alternative. #14267 reverts the commit. The operator was told, with a stop option.

**11-04 20:27Z, triage (triager):** bug/medium/IR (inline)/P2. Option A (no debug-inst cloning at module scope, `b5ff14441`) is
recommended. B is E31226 for struct static members (front end, possibly breaking). C (consumer side) is rejected.
Handed to slang-fixer (msg 61, thread `gh-issue-shader-slang/slang-14321`, branch `fix/issue-14321`, `pr: non-breaking`).
Triage 5-bullet **6641283107**. Memo: inbox `a2a-1793824042445-mo2a5a/triage-14321.md`. Next: the draft PR number.
**11-04 21:26Z (fixer, via the triager):** /code-review widened the predicate from `!as<IRBlock>(call->getParent())` to
`!getParentFunc(call)`. Reason: a `[__unsafeForceInlineEarly]` call in a generic struct's static const sits in the
generic body block and still ICEd under `-g`. Revert drill: 5/6 lanes fail. No PR yet.
**Side find (not filed):** `[__unsafeForceInlineEarly]` with a `var` in a generic `Holder<let N:int>` static const gives
E99997 on cpp/metal/sharedlib at every `-g` level, pre-existing, from the same `as<IRBlock>` test at
slang-ir-inline.cpp:314. The triager and the fixer disagree on spirv. Repro: `/workspace/agent/scratch/t14238-ice/early-var.slang`
(triager group). **My call:** file it only if public `[ForceInline]` or core-module code reaches the same shape;
if only the internal attribute does, hold it with a note in the #14321 PR. Once the spirv disagreement is resolved,
#14321 can cover it if the widened predicate fixes it.
**11-04 21:54Z: draft PR #14325 OPEN** (`fix/issue-14321`, head `49d30ee36`, `pr: non-breaking`, 2 files). The test passes 1/6 on
master and 6/6 with the fix. Suite 11735/11738 (`fp8-cuda*`). CI 41920180488. Peer review requested. Issue comment
6641283107 now points at #14325. **Side find not filed** (only the internal attribute reaches it). #14325 does not fix
it, and the PR's Risk line names it. spirv: invalid SPIR-V, shown only by `SLANG_RUN_SPIRV_VALIDATION=1`.
Next: review verdict. A maintainer picks keep-fix or E31226. Ready-flip goes on the weekly list (not a regression).
**11-05 00:24Z (triager):** the fixer session is alive. The 23:05Z errors were the gateway 500 wave. R1 = APPROVE_WITH_NITS.
Local `51f977446` keeps debug info for global-var initializers and adds a SPIR-V pin test; the nits are on top, 8/8. The
full suite is running. Next: push, then the [Fix Report] and "ready-flip pending" through the triager, then the **weekly
list** (not a direct ask). The Q1 question is on this issue, as comment 6646031120.
**11-05 00:52Z: #14325 head `4929edf8a`** (draft). R1 remedy and nits N1-N4 applied. Suite 11737/11740 (`fp8-cuda*`). CI 41944450993. **Ready-flip pending, weekly list** (not a regression, so no direct ask).
**11-05 00:56Z:** the triager confirmed #14325 is "ready-flip pending" for the **weekly list**, together with the Q1 answer (6646031120).
**11-17 14:47Z (fixer report, receipt verified):** jkwak-work @-mentioned the bot on the issue (comment 6950985087) questioning whether the repro
shader is valid at all — `divisor` is a runtime uniform, so a `static const` initializer over it can't be compile-time. Fixer replied 6951383406:
agreed it should be rejected; root cause = the E31226 "static const global initializer must be a compile-time constant" check is gated on
`isGlobalDecl(varDecl)` (slang-check-decl.cpp:3834), false inside a struct, so the front end accepts it and execution reaches the `-g` ICE.
Proposed: keep #14325 (inliner fix, correct under either semantics; ready-flip pending) + implement the E31226 struct-member extension as a
separate change **if jkwak-work confirms the intended semantics** (it rejects currently-legal code). **Parked awaiting his A/B + semantics answer**;
register entry updated. Fixer session i9d99t owns.
**11-17 17:32Z (fixer report, receipt verified):** jkwak-work APPROVED #14325 (review 5943399084, 17:30Z: *"I feel like there gotta be a better way than
this but it looks good for now."*). The "better way" = the open E31226-struct-statics semantics question (bot issue reply 6951383406); fixer PR reply
6955782602. **PR is now non-draft, head `f6ccfc9c`, mergeable_state blocked (CI)** — flipped out of draft by the maintainer, so the weekly-list
ready-flip item for #14325 is done. Remaining open item: jkwak-work's issue-thread answer on extending E31226 to struct `static const` members
(separate change; fixer follows up if confirmed). Not a regression; no direct undraft ask was needed.
**11-17 21:24Z (fixer report, receipt verified): TERMINAL — PR #14325 MERGED** by jkwak-work at 21:22Z (merge commit `9c105e5c`, head
`f6ccfc9c7`); he flipped it ready and merged master in earlier that day. **Issue #14321 auto-closed.** Fixer removed `wt-slang-14321` and the
`active-work/slang-14321` sentinel. **Residual (closed UNANSWERED):** the E31226-for-struct-`static const`-members semantics question —
jkwak-work approved the inliner fix "for now" and never answered the A/B question (bot comments 6646031120, 6951383406). If a maintainer
answers or reopens, fixer i9d99t owns the diagnostic follow-up; no action otherwise.
