---
type: chain-log
title: slang#14238 — dated history
description: Dated readings of the #14238 chain (11-03 filing and operator ask, fixer chain start, Approach A→3-commit design, draft PR #14267, side finds #14278-80, 11-04 jhelferty-nv per-thread direction, r2 rework, #14321 split, #14330 filed, R3 APPROVE + ready-flip ask 11-05 00:5xZ); current state lives in the chain record, new dated entries append here
---

# slang#14238 — dated history

Chain record (bug, cause, current state, binding decisions, do-not-dispatch list): [[slang/14238-int-div-forceinline-global-const-regression.md]].
New dated entries go **here**, one bullet each. When this file nears 16 KB, prune the oldest superseded entries.
Numbers are the coworker's own unless marked verified.

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

**11-04 19:05:44Z: maintainer direction on #14238** (jhelferty-nv, #14267's board-sync shepherd; comment
6639517817): "Based on discussion, the bug here is that the code generated doesn't compile. This should be
implemented as a dynamic calculation. (There was no promise in the language beforehand that this would be resolved
to a compile-time constant, should be a per-thread dynamic calculation.)" This goes against #14267 commits (1) and
(3), which fold the array to a constant. The operator never answered the 11-03 23:5xZ ready-flip ask, and it is now
**moot** until the rework (the operator was told). **Routing (Main `sess-1793690897967-0o6crb`, 19:1xZ):** the
fixer's parent, the t-700e05 triager session `sess-1793667544858-o8dnsv`, is **closed**. Precedent says to relay
through the triager and never go direct to the fixer, so I opened a fresh slang-triager session on
`gh-issue-shader-slang/slang-14238` with the full context. It relays the comment verbatim to fixer
`sess-1793732830219-r1jbdf` (pin + own-row in_reply_to). The fixer sends a plan before pushing. The PR stays a
draft, with no force-push. A question for the maintainer comes to me first.
**11-04 19:26Z, triager interim (triager-reported, not verified by me):** on master `3da6f63c0`, the #14238 repro already
compiles. jkwak-work's #14204 ("Emit static const struct arrays as global constants (#13107)") moves a module-scope
array that contains calls into each kernel, which is the per-thread shape. I verified the merge myself: **02:32:33Z**
11-04, merge `139f09f597`; the triager said 01:16Z. One variant still fails: a helper without `[__readNone]`, with
the array as a struct static member. #14267 may shrink to that variant plus commit (2).
**11-04 19:28Z (triager-reported):** commit (2) is still needed on master. The `-g` ICE E99997 still happens there.
The remaining variant leaves orphaned module-scope operand calls (`__device__ static const int _S2 = ceilDiv_0(7,2);`).
The triager's hypothesis is the producer: `inlineGlobalValuesAndRemoveIfUnused` deletes only the root, and DCE keeps
the calls that are not readNone. That is the same producer as #14217, so the plan should check #14217 too. #14267's
base is `f1cd35ff8`, from before #14204.
**11-04 19:40Z, fixer interim (via the triager; local only, not verified):** the prototype on master `3da6f63c0` is
one producer change. `inlineGlobalValuesAndRemoveIfUnused` also deletes the operands that were inlined with the root
and have no uses left. It fixes the remaining variant, a plain non-inline helper in the same shape, and
**#14217** (`-g`). The orphans have no uses, so debug values do not keep them alive. The full suite is running.
I asked the fixer to show that deleting a no-use, non-readNone call is safe.
**11-04 20:10Z: `[Triage Resolution]`, plan r2** (plan file at inbox `a2a-1793823046040-ifzpd1/slang-14238-r2-plan.md`;
issue delta **6640934112** posted). The plan:
- Revert commits (1) `06d680192` and (3) `883bedf6a`, and the matching hunks of `1c20be535`.
- `git merge origin/master`, with no force-push.
- A new commit adds a worklist to `inlineGlobalValuesAndRemoveIfUnused` that removes inlined operands once they have
  no uses. The per-thread form comes from #14204's `IRCall` rule in `inlineGlobalConstantsForLegalization`.
- `idiv(10,0)` behaves as on master.
- An orphan-position atomic test shows the effect is not lost. On HLSL it also removes 2 duplicate runs of the initializer.
- The PR becomes **Fixes #14238 + Fixes #14217** and is retitled.
- Suite 11728/11731 (`fp8-cuda*`).

**My decisions (20:1xZ):** (a) **GO**. (b) **Commit 2 (`b5ff14441`, the `-g` debug-inst clone skip) is split into its own
PR.** It fixes an independent master ICE, E99997 "no outer func at use site for global" (uniform-arg, cpp/metal/cpu, `-g`).
The triager files an issue for it first: dedup against #9078, and check pre-#14150 `6815ed82d` to tell whether it is a
regression. Then a new fixer chain runs on that issue's thread (it cherry-picks `b5ff14441`), and #14267 reverts the
commit. The triager's observation that an effectful element call runs once per read is the same as on master, so it
gets one line in the description and no issue. The operator was told about the new chain, with a stop option.
**11-04 20:24Z: commit 2 filed as [#14321](14321-g-debug-clone-module-scope-uniform-ice.md)** (triager msg 55). It is not
a regression and not a dup of #9078. Its `issue_opened` was not dispatched. The triager starts the #14321 fixer chain,
and #14267 gets a one-line pointer. Triager msg 55 also asks me to OK a #14280 comment for the assignee: #14280 passes
on master `3da6f63c0`, probably fixed by #14204. That OK belongs to this chain's Main `sess-1793690897967-0o6crb`.
**11-04 21:25Z: r2 pushed.** Head `d97af15bf` (fast-forward, 13 ahead of master `3da6f63c0`), still a draft,
retitled, Fixes #14238 + #14217. CI run 41915474315 is waiting (approval-gated). The reviewer round is requested.
Next: verdict → ready-flip question → operator directly.
**11-04 21:26Z:** the #14238 delta 6640934112 was edited in place to show r2 pushed, #14217 fixed, the `-g` fix moved to
#14321, and the ready-flip left to maintainers after review.
**11-04 22:36Z: R2 = REQUEST_CHANGES** (small, 0 bugs). The fixer is applying it locally:
- M1 `5276d6fe4`: uses inside an `IRGlobalVar` initializer.
- G1 `070244b3e`: tests for nested operands and an operand used twice.
- 37 lanes, 30 of which fail on master.

**Q1** (also the #14321 question): E31226 (#10925) rejects a non-readNone initializer for a module-scope `static const`,
but a struct `static const` member skips it (`isGlobalDecl`, slang-check-decl.cpp:3833) and is evaluated once per read.
**My call:** post the question **once, on #14321**, not on #14238, because jhelferty-nv's #14238 direction does not
decide it. Neither PR blocks on it.

**Q2:** `docs/user-guide/02-conventional-features.md:599` says a global `static const` "defines a compile-time constant",
which goes against the direction. Hold it until Q1 is answered. For now, one line in the #14267 description.

**S4:** `int2` vector `/` in a global const array gives a CUDA dynamic init on ptx only. The cause may be #14204's
`isLegalGlobalInstForTarget`. It is related to #13444 (jkwak-work). Decision: check v2026.21 (pre-#14204) for a
regression, then file it filed-only, with no fixer chain.
**11-05 00:23Z (triager):** Q1 was posted on #14321 as comment **6646031120**. Both PR bodies will link it. Q2 got one
line in #14267's description (relayed). **S4 was filed as #14330**, filed-only and not a regression (v2026.18/.21,
`6815ed82d` and master all fail ptx): CUDA vector arithmetic (`+ * / %`, `int2`/`float2`) in a global const gives a dynamic
init. Related to #13444; no fixer chain. **Do not dispatch #14330's `issue_opened`**, because it belongs to this chain.
Infra: both fixer sessions (#14238 and #14321 threads) errored ("Sorry, something went wrong") at 23:05Z. The #14238
one wrote to me at 00:18Z, and the triager is checking the #14321 one.
**11-05 00:41Z: R2 pushed**, head `485637d9c` (verified), still a draft. Body has the Q1 link, the docs :599 line, and Fixes #14238 + #14217. CI 41942522276 waits for approval. Next: re-review, then the ready-flip question, then the operator directly.
**11-05 00:56Z: review converged.** R3 APPROVE, 0 bugs and 0 gaps (fixer-reported). Head `485637d9c` (verified), 9 files
+519/−9, 37/37 new lanes. CI 41942522276 waits on the approval gates. **00:5xZ: ONE direct ready-flip ask to the operator**
(regression exception; v2026.21 shipped with the regression): "flip 14267" or "hold 14267". I recommended flipping now
without waiting for Q1. **No re-ask.** If there is no answer, it goes on the weekly list. The fixer holds `gh pr ready`
until I relay an answer.
