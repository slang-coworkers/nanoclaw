---
type: chain
title: slang#14238 — `[ForceInline]` helper with integer `/` or `%` in a global `static const` array is no longer folded (G1 regression from #14150)
description: Bot-filed (slang-triager) 2026-11-03 ~07:28Z from the #14133 chain. G1 regression from merged #14150, not fixed by #14236. Do NOT dispatch its issue_opened webhook. Fixer chain started 11-03 19:0xZ (triager to fixer, thread gh-issue-shader-slang/slang-14238).
tags: [cuda, glsl, cpp, force-inline, static-const, regression, integer-division]
---

# slang#14238: G1 regression from #14150 (integer `/`/`%` in a global-scope helper)

⚠️ **The `issue_opened` webhook belongs to the [#14133 chain](14133-cuda-static-const-forceinline-init-file-scope.md),
so do not dispatch it.** slang-triager filed it from that chain's triage session `sess-1793514365085-a6bfnv`.

**Bug.** `[ForceInline] int ceilDiv(int a, int b) { return (a + b - 1) / b; }` in
`static const int arr[2] = { ceilDiv(10, 4), ceilDiv(7, 2) };` (runtime-indexed). Since #14150 (merged 11-03
02:06:54Z, merge `76a45e10c1`), the call stays in the module-scope initializer, and NVRTC, glslang and C++ reject
it. Direct SPIR-V passes. It fails with and without `-g`, with and without `[__readNone]` (also as a struct
member), and for `%` too. A literal divisor passes. A scalar `static const int k = ceilDiv(10,4)` compiles, but
as a per-use call instead of a folded constant. Pre-#14150 `6815ed82d` passes. Cause: `isInlinableAtGlobalScope`
refuses any inst where `mightHaveSideEffects()` is true, and int div/rem with a non-literal divisor is
side-effecting (`slang-ir.cpp:9799-9811`). Our #14150 comment 6592707618 flagged it before the merge.

**Not fixed by #14236** (jvepsalainen-nv's fix for G2/#14235, which only skips debug insts in the same function).
The triager verified #14236 head `4c34875db` 11-03.

**State (11-03 07:29Z).** Type=Bug, `reproduced`, `regression`. No fixer. slang-fixer holds a candidate patch on
local `fix/issue-14133` (skip debug insts and refuse only no-use side-effecting insts). That overlaps #14236's
debug half. The triager's `t-700e05` (daily from 11-03 19:00Z) watches #14236, #14217, #14235, #14238 and any
PR referencing #14238.

**Operator ask (11-03 ~07:3xZ, from Main session `sess-1793514266152-ji3fz3`, where the triager's `[Triage Resolution]`
msg 70 arrived).** ⚠️ Sibling sessions: **this ask is already sent, so do not send another.** The question is whether
to start a fixer chain for #14238. My recommendation is yes, a scoped draft PR: only "refuse a side-effecting inst
only when it has no uses", leaving debug-inst handling to #14236, based on master, and composing with #14236. The
alternative is to hold #14238 as filed-only, in case jvepsalainen-nv folds G1 into #14236 (same `default:` case).
Without an answer, nothing starts and #14238 stays filed-only.

**11-03 19:0xZ: #14236 MERGED 18:35:33Z** (merge `7f4efc7ce`; head moved only by a test rename). #14235 auto-closed.
G1 is still on master. No human comments on #14238 or #14217, and no PR references #14238. jkwak-work's draft
#14243 (stacked on #14236) only splits the debug-inst `continue` into its own `if`, so it does not touch G1.
**Operator never answered the 07:3xZ ask.** Option 2 (jvepsalainen-nv folding G1 into #14236) can no longer
happen, so I **started the fixer chain** under the filing policy ("starting a fixer chain: report it"), as a
regression fix. I reported this to the dashboard with a stop option. Route: the triager sends a `[Triage
handoff]` to slang-fixer on `gh-issue-shader-slang/slang-14238`. The seed is the local `fix/issue-14133`
patch; the PR is a draft on current master, scoped to "refuse a side-effecting inst only when it has no uses".
The ready-flip comes to the operator directly (regression exception).
**11-03 19:10Z, triage + handoff.** regression/high/P1. Re-verified on master `7f4efc7ce`. Handed to slang-fixer
(triager msg 19, thread `gh-issue-shader-slang/slang-14238`, memo triage-14238.md). Fixer acked (msg 26) on
branch `fix/issue-14238` from `7f4efc7ce`, Approach A. Extra tests: a used nested call and a Debug no-assert
check. Issue 5-bullet 6613001265 posted. The ready-flip goes fixer → triager → me, not the weekly list.
The triager's watch successor `t-cf08a9` (#14217 only, re-arming daily) was cancelled on my instruction:
#14217 is filed-only, and webhooks carry its human comments.

**11-03 21:42Z, fixer replaced Approach A** (triager report, row 2 in Main `sess-1793742162390-w5a3o1`, from the
triager's `t-700e05` session `sess-1793667544858-o8dnsv`; fixer session `sess-1793732830219-r1jbdf`). Fixer-reported,
not verified by me: A (`mightHaveSideEffects() && !hasUses()`) regresses master in 5 shapes (the same failures as
v2026.18). The new design has 3 commits: (1) `mightHaveSideEffects` reports no side effect for int Div/IRem at module
scope; (2) global-scope inlining stops cloning debug insts into module scope (fixes a master `-g` ICE that (1)+(3) would
extend to div helpers); (3) a Div/IRem arm in `isInlinableAtGlobalScope`. 25/25 tests pass; full suite was running.
Behavior change: `idiv(10,0)` now gives E30002, like `10/0`. No PR yet.
**My decision (21:4xZ): no objection to (2), so the scope widens.** Reason: the debug-inst exclusion was there to avoid
colliding with #14236 while it was open. #14236 merged 18:35Z, and (2) is the clone side, not the check that
#14236/#14243 edit. Conditions sent to the triager: (2) is its own commit with a test that fails on master; the PR states
whether the ICE is reachable on master alone, with no blame wording about #14236; check whether it fixes #14217 (test it
if so, one line if not); note the #14243 overlap; a revert drill per commit, plus why both (1) and (3) are needed and that
(1) is safe for other `mightHaveSideEffects` callers; `idiv(10,0)`: if v2026.18 also errors, label non-breaking,
otherwise bring the options (keep E30002 + breaking, or constant-zero divisor stays side-effecting) to me first.
Local Release build is from 11-02 (pre-#14150), so I did not reproduce the ICE myself.
**11-03 21:46Z, triager relayed my conditions** (fixer msg 40, head `883bedf6a` on master `f1cd35ff8`; fixer-reported,
not verified). Full suite 11450/11453 (3 `fp8-cuda*` also fail on master). Ask 5 met: v2026.18 also gives E30002 for
`idiv(10,0)`, so `pr: non-breaking`. Ask 4 caller part met: 3 callers see module-scope insts (emit-c-like
`getFoldPolicy`, DCE, specialize); module CSE does not use `mightHaveSideEffects`. Commit (2) = `b5ff14441`; test
`14238-global-const-force-inline-uniform-arg.slang` fails 3/4 lanes on master, so the `-g`/debug-clone bug exists on master
alone (the PR will say so). Open before the draft: wording for (2), #14217 repro, #14243 note, per-commit revert drill.
No reply owed; next inbound is the PR number + ready-flip question.
**11-03 22:16Z: draft PR #14267 OPEN** (verified by me: draft, head `883bedf6a`, `fix/issue-14238`, `pr: non-breaking`;
pr-mapping → fixer `sess-1793732830219-r1jbdf`). CI run 41727701195. Explanation comment 6616760583; issue 5-bullet
6613001265 edited to "fix in draft PR #14267, held". Fixer-reported: all 5 asks covered; (2) described as a master ICE
(`-target cpp -g` on 7f4efc7ce exits 255, E99997); #14217 NOT fixed (one line in PR); revert drill 3/3/12 lanes.
Next: fixer peer review → ready-flip question via triager → me → operator directly (regression exception).
**11-03 23:27Z: #14267 R1 = APPROVE_WITH_NITS** (fixer-reported); nits applied without a new round, then the ready-flip
question. The reviewer's 3 pre-existing side finds were filed by the triager as #14278, #14279, #14280 (records in this
folder). Main 23:3xZ: #14278 fixer chain started via the triager (repro under `timeout`+`ulimit -v`); #14279/#14280 held
filed-only (9 fixer sessions running); operator told on the dashboard (table, stop/start option).
**11-03 23:51Z: ready-flip question** (triager row 38; fixer [Fix Report] msg 56). #14267 head `1c20be535`, 6 commits,
8 files +371/−1, R1 nits applied, 0 human reviews/comments. CI run 41739559736 `waiting`; 53 checks skipped as draft.
**23:5xZ: ONE direct ask sent to the operator** (dashboard, regression exception): "flip 14267" / "hold 14267". No
re-ask. If no answer, it stays a draft and goes on the weekly ready-flip list ("ready-flip pending"). Triager told: no
`gh pr ready` until I relay an answer; fixer watches run 41739559736.
