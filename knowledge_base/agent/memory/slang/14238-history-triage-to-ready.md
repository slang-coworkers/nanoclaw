---
type: chain-log
title: slang#14238 — dated history
description: Dated history of the #14238 chain, 11-03 filing to 11-16 TERMINAL (#14267 merged, #14238 + #14217 auto-closed) - operator ask, fixer chain start, Approach A superseded by the r2 per-thread rework after jhelferty-nv's direction, side finds #14278-80, #14321 split, #14330, R3 APPROVE. Current state lives in the chain record, new dated entries append here.
---

# slang#14238 — dated history

Chain record (bug, cause, current state, binding decisions, do-not-dispatch list): [[slang/14238-int-div-forceinline-global-const-regression.md]].
New dated entries go **here**, one bullet each. When this file nears 16 KB, prune the oldest superseded entries.
Numbers are the coworker's own unless marked verified. Pruned 2026-11-16: the superseded 11-03 Approach-A entries were condensed after the r2 rework made them moot.

## 2026-11-03: filed, operator ask, fixer chain start, Approach A superseded (condensed)

- **State at filing (11-03 07:29Z).** Type=Bug, `reproduced`, `regression`. slang-fixer held a candidate patch on
  local `fix/issue-14133` (skip debug insts and refuse only no-use side-effecting insts), overlapping #14236's
  debug half; the triager's `t-700e05` (daily from 11-03 19:00Z) watched #14236, #14217, #14235, #14238.
- **Operator ask (11-03 ~07:3xZ, from Main session `sess-1793514266152-ji3fz3`).** ⚠️ Sibling sessions: this ask
  was already sent — do not send another. Whether to start a fixer chain for #14238; my recommendation was yes,
  a scoped draft PR ("refuse a side-effecting inst only when it has no uses"), leaving debug-inst handling to
  #14236. **Operator never answered.**
- **#14236 MERGED 18:35:33Z** (merge `7f4efc7ce`); #14235 auto-closed; G1 still on master. With the operator
  silent and option 2 (jvepsalainen-nv folding G1 into #14236) no longer possible, I **started the fixer chain**
  under the filing policy ("starting a fixer chain: report it"), as a regression fix, and reported it to the
  dashboard with a stop option. 19:10Z triage + handoff: regression/high/P1, re-verified on master `7f4efc7ce`;
  fixer acked on branch `fix/issue-14238` from `7f4efc7ce`, Approach A; issue 5-bullet 6613001265 posted. The
  triager's watch successor `t-cf08a9` (#14217 only) was cancelled on my instruction: #14217 is filed-only and
  webhooks carry its human comments. The ready-flip goes fixer → triager → me, not the weekly list.
- **21:42Z, fixer replaced Approach A** (triager report; fixer session `sess-1793732830219-r1jbdf`): A
  (`mightHaveSideEffects() && !hasUses()`) regresses master in 5 shapes (the same failures as v2026.18). New
  3-commit design: (1) `mightHaveSideEffects` reports no side effect for int Div/IRem at module scope; (2)
  global-scope inlining stops cloning debug insts into module scope (fixes a master `-g` ICE); (3) a Div/IRem
  arm in `isInlinableAtGlobalScope`. My decision: no objection to (2) — #14236 had merged, and (2) is the clone
  side, not the check #14236/#14243 edit — with conditions (own commit + test failing on master; PR states the
  ICE is reachable on master alone, no blame wording; check #14217; note #14243 overlap; per-commit revert
  drill; `idiv(10,0)` = E30002 like v2026.18 → `pr: non-breaking`). 22:16Z: draft PR #14267 OPEN (verified:
  head `883bedf6a`, `fix/issue-14238`, `pr: non-breaking`; CI run 41727701195; explanation comment 6616760583).
- **23:27Z: R1 = APPROVE_WITH_NITS** (fixer-reported); nits applied without a new round. The reviewer's 3
  pre-existing side finds were filed as #14278, #14279, #14280 (own chains now). 23:51Z ready-flip question;
  23:5xZ ONE direct ask sent to the operator (dashboard): "flip 14267" / "hold 14267", no re-ask. Triager told:
  no `gh pr ready` until I relay an answer.

## 2026-11-04: maintainer direction, r2 rework, splits

- **19:05:44Z: maintainer direction on #14238** (jhelferty-nv, #14267's board-sync shepherd; comment
  6639517817): "Based on discussion, the bug here is that the code generated doesn't compile. This should be
  implemented as a dynamic calculation. (There was no promise in the language beforehand that this would be
  resolved to a compile-time constant, should be a per-thread dynamic calculation.)" This goes against #14267
  commits (1) and (3), which fold the array to a constant. The operator never answered the 11-03 23:5xZ
  ready-flip ask, and it is now **moot** until the rework (the operator was told). **Routing (Main
  `sess-1793690897967-0o6crb`, 19:1xZ):** the fixer's parent, the t-700e05 triager session
  `sess-1793667544858-o8dnsv`, is **closed**. Precedent says to relay through the triager and never go direct
  to the fixer, so I opened a fresh slang-triager session on `gh-issue-shader-slang/slang-14238` with the full
  context. It relays the comment verbatim to fixer `sess-1793732830219-r1jbdf` (pin + own-row in_reply_to). The
  fixer sends a plan before pushing. The PR stays a draft, with no force-push. A question for the maintainer
  comes to me first.
- **19:26Z triager interim (not verified by me):** on master `3da6f63c0` the #14238 repro already compiles.
  jkwak-work's #14204 ("Emit static const struct arrays as global constants (#13107)") moves a module-scope
  array that contains calls into each kernel — the per-thread shape. I verified the merge myself: **02:32:33Z**
  11-04, merge `139f09f597` (the triager said 01:16Z). One variant still fails: a helper without
  `[__readNone]`, with the array as a struct static member. #14267 may shrink to that variant plus commit (2).
  19:28Z (triager-reported): commit (2) is still needed on master (the `-g` ICE E99997 still happens); the
  remaining variant leaves orphaned module-scope operand calls (`__device__ static const int _S2 =
  ceilDiv_0(7,2);`); hypothesis: the producer `inlineGlobalValuesAndRemoveIfUnused` deletes only the root,
  and DCE keeps the non-readNone calls — same producer as #14217, so the plan should check it. #14267's base
  `f1cd35ff8` predates #14204.
- **19:40Z fixer interim (via the triager; local only, not verified):** prototype on master `3da6f63c0` is one
  producer change — `inlineGlobalValuesAndRemoveIfUnused` also deletes the operands that were inlined with the
  root and have no uses left. Fixes the remaining variant, a plain non-inline helper in the same shape, and
  **#14217** (`-g`). Orphans have no uses, so debug values don't keep them alive. I asked the fixer to show
  that deleting a no-use, non-readNone call is safe.
- **20:10Z `[Triage Resolution]`, plan r2** (plan file at inbox `a2a-1793823046040-ifzpd1/slang-14238-r2-plan.md`;
  issue delta **6640934112** posted). The plan: revert commits (1) `06d680192` and (3) `883bedf6a` and the
  matching hunks of `1c20be535`; `git merge origin/master`, no force-push; a new commit adds a worklist to
  `inlineGlobalValuesAndRemoveIfUnused` that removes inlined operands once they have no uses (per-thread form
  comes from #14204's `IRCall` rule in `inlineGlobalConstantsForLegalization`); `idiv(10,0)` behaves as on
  master; an orphan-position atomic test (on HLSL it also removes 2 duplicate runs of the initializer); the PR
  becomes **Fixes #14238 + Fixes #14217** and is retitled; suite 11728/11731 (`fp8-cuda*`).
- **My decisions (20:1xZ):** (a) **GO**. (b) **Commit 2 (`b5ff14441`, the `-g` debug-inst clone skip) is split
  into its own PR** — it fixes an independent master ICE, E99997 "no outer func at use site for global"
  (uniform-arg, cpp/metal/cpu, `-g`). The triager files an issue for it first (dedup against #9078, check
  pre-#14150 `6815ed82d` for regression), then a new fixer chain on that issue's thread (cherry-picks
  `b5ff14441`), and #14267 reverts the commit. The effectful-element-call-runs-once-per-read observation gets
  one line in the description, no issue. Operator told, with a stop option.
- **20:24Z: commit 2 filed as [#14321](14321-g-debug-clone-module-scope-uniform-ice.md)** (triager msg 55). Not
  a regression, not a dup of #9078. Its `issue_opened` was not dispatched. The #14321 fixer chain started;
  #14267 gets a one-line pointer. Triager msg 55 also asked me to OK a #14280 comment for the assignee (#14280
  passes on master `3da6f63c0`, probably fixed by #14204) — that OK belongs to this chain's Main
  `sess-1793690897967-0o6crb`.
- **21:25Z: r2 pushed.** Head `d97af15bf` (fast-forward, 13 ahead of master `3da6f63c0`), still a draft,
  retitled, Fixes #14238 + #14217. CI run 41915474315 waiting (approval-gated). 21:26Z: delta 6640934112 edited
  in place (r2 pushed, #14217 fixed, `-g` fix moved to #14321, ready-flip left to maintainers after review).
- **22:36Z: R2 = REQUEST_CHANGES** (small, 0 bugs). The fixer applied locally: M1 `5276d6fe4` (uses inside an
  `IRGlobalVar` initializer), G1 `070244b3e` (tests for nested operands and an operand used twice); 37 lanes,
  30 of which fail on master.
- **Q1** (also the #14321 question): E31226 (#10925) rejects a non-readNone initializer for a module-scope
  `static const`, but a struct `static const` member skips it (`isGlobalDecl`, slang-check-decl.cpp:3833) and is
  evaluated once per read. **My call:** post it **once, on #14321**, not #14238 — jhelferty-nv's #14238
  direction does not decide it; neither PR blocks on it. **Q2:**
  `docs/user-guide/02-conventional-features.md:599` says a global `static const` "defines a compile-time
  constant", against the direction — hold until Q1 is answered; one line in the #14267 description. **S4:**
  `int2` vector `/` in a global const array gives a CUDA dynamic init on ptx only (maybe #14204's
  `isLegalGlobalInstForTarget`; related to #13444). Decision: check v2026.21 for a regression, then file
  filed-only, no fixer chain.


## 2026-11-05: review converged; ready-flip ask

- **00:23Z (triager):** Q1 posted on #14321 as comment **6646031120** (both PR bodies link it). Q2 got one
  line in #14267's description. **S4 filed as #14330**, filed-only, not a regression (v2026.18/.21,
  `6815ed82d`, master all fail ptx): CUDA vector arithmetic (`+ * / %`, `int2`/`float2`) in a global const
  gives a dynamic init. Related to #13444; no fixer chain. **Do not dispatch #14330's `issue_opened`** — it
  belongs to this chain. Infra: both fixer sessions (#14238, #14321) errored ("Sorry, something went wrong")
  at 23:05Z; the #14238 one wrote to me at 00:18Z, the triager checked the #14321 one.
- **00:41Z: R2 pushed**, head `485637d9c` (verified), still a draft; body has the Q1 link, the docs :599 line,
  Fixes #14238 + #14217; CI 41942522276 waits for approval.
- **00:56Z: review converged.** R3 APPROVE, 0 bugs 0 gaps (fixer-reported). Head `485637d9c` (verified),
  9 files +519/−9, 37/37 new lanes. **00:5xZ: ONE direct ready-flip ask to the operator** (regression
  exception; v2026.21 shipped with the regression): "flip 14267" or "hold 14267"; I recommended flipping now
  without waiting for Q1. **No re-ask** — with no answer it goes on the weekly list. The fixer holds
  `gh pr ready` until I relay an answer.

## 2026-11-16: TERMINAL

- **06:41Z (triager [Triage Resolution]): TERMINAL.** #14267 merged 2026-11-13T06:45:31Z by jkwak-work
  (triager-verified via public API); #14238 + #14217 auto-closed. Final shape per jhelferty-nv's cmt
  6639517817: per-thread dynamic evaluation, no module-scope orphan calls (cleanup in
  `inlineGlobalValuesAndRemoveIfUnused`), HLSL DXC duplicate-effect removal. Full suite 11765/11768
  (fp8-cuda* pre-existing on master). Fixer cleaned worktree + sentinel. Side finds #14278/#14279/#14280 on
  own chains; #14330 terminal (fixed by #14467); #14321 split unaffected, own chain. Maintainer cmt 6837518027
  (jkwak-work 11-12, pre-merge) muses about reverting #14150 / more user control over [ForceInline] — design
  context for #14321's open Q1, no reply needed.
- **Residual close-out:** stale delta comment 6640934112 ("reworked/draft") — parked on one-shot retry
  `t-244861` (13:00Z 11-16), blocked by the GitHub 401 auth outage (operator alerted 04:41Z 11-16); after the
  retry the triager escalates once and stops.
**11-17 16:03Z (triager [Report]): residue re-check — still blocked, now a full disconnect.** The gateway's
GitHub path degraded from stale-cred 401 to `app_not_connected` ("GitHub is not connected in OneCLI"), so the
PATCH of 6640934112 cannot run. Triager is permanently parked (no retry, no probe); it PATCHes in one shot on
reconnect or a human comment. Connect URL relayed to the operator 16:0xZ. Residue is cosmetic — merged PR
#14267 + closed #14238/#14217 carry the trail.
