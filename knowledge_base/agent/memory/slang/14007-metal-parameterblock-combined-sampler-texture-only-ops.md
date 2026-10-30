---
type: chain
title: slang#14007 (+ #14006) — Metal ParameterBlock combined Sampler2D: Load/GetDimensions abort or emit invalid MSL
description: Human-filed (EiffelOberon) 10-29, same root cause as sibling #14006; triaged P2, one fix chain for both via slang-fixer on the 14007 thread; must not push to #13741 (owned by the #13737 fixer session)
---

# slang#14007 (+ sibling #14006): Metal `ParameterBlock<Sampler2D>` texture-only ops

- Filed 2026-10-29 09:28Z by EiffelOberon (external). #14006, by the same reporter, was filed one minute
  earlier. A sibling Main session (`sess-1793266097711-jwo51v`) runs #14006, and its triager session is
  `sess-1793266172653-5hohp3`. My session for #14007 is `sess-1793266099686-h31wzw`.
- 09:29Z dispatched to slang-triager on `gh-issue-shader-slang/slang-14007` (triager `sess-1793266192659-3hlxu4`).
- 09:37Z triage (msg 12; memo at `/workspace/inbox/a2a-1793266660791-mcklvf/triage-14007.md`). The triager
  reports (I have not verified this): reproduced at master 01dcd3568; bug, high, P2, not a regression;
  labels `reproduced` + Type=Bug. Root cause: the Metal texture-only intrinsic strings use `$0` as the
  texture. A ParameterBlock keeps the lowered `{texture, sampler}` struct whole, so the result is E99997 at
  `$z` (`slang-intrinsic-expand.cpp:681`) for Load/subscript, and `.get_width` on the struct pointer for
  GetDimensions. Second gap: a Load-only ParameterBlock drops the sampler, so the MSL and the reflection
  disagree. Recommended A: on `case metal:`, forward through `__getTexture()` with #13741's trampolines,
  and register every combined type. #13741 does NOT fix this case.
- The triager handed off to slang-fixer itself (`sess-1793266674350-hgic9q`, thread 14007). The PR is to
  carry `Fixes #14006` and `Fixes #14007`.
- 09:4xZ my sends: (a) a peer ping to the #14006 triager, pinned to …5hohp3 (msg 27): no second fix chain,
  post the shared root cause on #14006 itself, and reply if it has already handed off. (b) To the #14007
  triager (msg 29, relay to the fixer): **never push to `fix/issue-13737`/#13741.** That PR is
  owned by `sess-1792252474641-muhgh6` (see [13737](13737-hlsl-combined-sampler-texture-only-ops.md)).
  Use a separate stacked draft `fix/issue-14007`, or ask me to route the change to the #13741 owner. A
  stacked PR inherits #13741's park (the `falcor-ci` gate, the operator's ready flip).
- 09:39Z triage comment posted on #14007 (issuecomment-6493217346, triager [Report] msg 28; it crossed my msg 29). The fixer is "building on top of #13741's branch". Msg 29 already limits that to a stacked branch, never a push to `fix/issue-13737`. #14006 had no comments at 09:37Z.
- 09:40Z triager (msg 30): relayed msg 29 to the fixer (stacked draft `fix/issue-14007`; never push to #13741).
- ⚠️ **My pinned peer ping (msg 27) was misrouted** into the #14007 triager session (`…3hlxu4`, its seq 18).
  The cause was my error, the known `in_reply_to`-beats-pin precedence
  ([feedback](../imported/feedback_in_reply_to_beats_target_session_id_pin.md)): I sent it without
  `in_reply_to=<own webhook row>`. It was not a host bug, although I first told the operator it was
  (dashboard msg 37). The sibling Main `…jwo51v` hit the mirror case and diagnosed it at 09:46Z.
- 09:42Z **resolved:** the #14006 triager posted comment 6493299044 (same root cause as #14007, fix prepared
  together). No second fixer session. 09:47Z triager (msg 38) sent 5 extra #14006 shapes to the fixer (msg 31);
  the fixer's closing report covers both issues.
- 10:40Z interim (triager msg 44): the fixer reports `fix/issue-14007` works locally and is not pushed. 11 shapes
  pass; suite 10952/10955 (3 known fp8 CUDA failures). Its self-review found a regression, which the triager confirmed on master:
  the combined-type lowering now reaches `cbuffer`/`ConstantBuffer<S>`/`uniform S`/entry-point `uniform Sampler2D`, where
  `lowerCombinedTextureSamplers` never rebuilds the nested layout, so it asserts at `slang-ir-legalize-types.cpp:3504`. The
  pass fault already exists on master (Sample: E99997 in Debug, bindings silently lost in Release; Load-only HLSL drops the sampler).
  The fixer is adding a nested-layout rebuild commit to this PR. **The fixer also claims #13741@ce23b34 already crashes on HLSL
  for 7 Load-only shapes that 2026.13.1 compiles.**
- 10:41Z relayed that #13741 claim to its owner `…muhgh6`, pin + `in_reply_to=2` (one send, msg 55, after a
  `database is locked` error wrote no row). It landed as its seq 32. Asked: reproduce, then cherry-pick / fix / leave to the stacked PR, then post on #13741.
  I have not told the operator yet. I will tell them once muhgh6 confirms, because the claim bears on the operator's ready-flip call for #13741.
- 10-29 10:50Z muhgh6 **confirmed** the #13741 regression (8 shapes; Release also loses `register(t1)`). It will cherry-pick
  this chain's nested-layout commit and write no fix of its own. The #13737 Main session (`kd4ktm`) asked the triager
  (msg 87, then the triager's msg 39 to `…hgic9q`) for a standalone, cherry-pickable commit and its SHA. **If the SHA
  reaches this session instead, relay it to `sess-1792252474641-muhgh6`** (pin + `in_reply_to`); see
  [13737](13737-hlsl-combined-sampler-texture-only-ops.md).
- 10:5xZ I sent the operator a "#13741 blocked" note (dashboard msg 73, thread 13737). It **duplicated** the #13737 owner session
  `kd4ktm`'s own notice (its seq 99, 10:52:58Z). Lesson: #13741's operator reporting belongs to its owning Main session. From
  the #14007 side, relay to the owner and let it report up.
- 12:31Z triager (msg 70): the fixer pushed the standalone commit **`ca41b168a`** to `fix/issue-14007`. I checked it through the API: its only
  parent is ce23b34, and it touches 2 files (the pass and the new `tests/type/texture-sampler/combined-texture-sampler-nested.slang`).
  The branch head is `9cbfaa02c4` (the Metal forwarding work). The fixer reports 8/8 shapes in Debug and Release, `register(t1)`, 1258 SIMPLE
  outputs byte-identical, and 2108/2108 targeted tests. 12:3xZ I relayed the SHA to muhgh6 (msg 81, pin + `in_reply_to=2`); it landed as muhgh6 seq 36 at 12:32:18Z.
- 12:58Z **DRAFT PR #14017** (triager msg 78). I checked it: draft, `pr: non-breaking`, `fix/issue-14007`@9cbfaa02c4,
  **base `fix/issue-13737`** (stacked on #13741), `Fixes #14006` + `Fixes #14007`. `pr-mappings` → fixer `…hgic9q`. The triager edited
  #14007 cmt 6493217346 in place ("fix in draft PR #14017, held"). PR Risk line: of 1258 SIMPLE outputs, 7 Metal outputs change (an unused
  global sampler is now omitted), plus some diagnostic line numbers. The triager will make the fixer's closing report explain these.
- 13:0xZ asked the #14006 triager (…5hohp3, pin + `in_reply_to=2`, msg 93) to edit #14006 cmt 6493299044 so it points at #14017.
- 13:00Z the #14006 triager edited cmt 6493299044 so it links #14017. 13:06Z the fixer posted fresh status comments, 6497487123 on #14007
  and 6497487552 on #14006. Both link #14017. Triager msg 88: slang-reviewer is reviewing (verdict expected ~14:30Z). The fixer
  reports gh-14007 12/12, the nested-layout test 3/3, and the suite 10956/10959 (3 known fp8). CI dispatch 40877192106 @9cbfaa0 is
  `waiting` on the `falcor-ci` gate, which I checked; the triager had called it "started".
- 13:34Z muhgh6 pushed `ca41b168a` + test `c94e1d0` to #13741. The #13741 R3 delta review was running (its 14:11Z interim: ca41b16 correct on its shapes).
- 14:36Z **#14017 R1 = REQUEST_CHANGES** (slang-reviewer; combined review at `/workspace/inbox/a2a-1793284611130-xk0db6/combined-review.md`;
  verdict msg 94). **B1, confirmed by running it:** a SIGSEGV in `ca41b168a` when a top-level `Sampler2D` sits next to a nested combined field.
  The two share a deduplicated `IRVarLayout`; the first loop's `removeAndDeallocate()` clears it, and the new loop then reads it. It crashes HLSL/WGSL/Metal,
  in both Release and Debug. Remedy, which the reviewer tested: remove only the decoration, plus the test `combined-texture-sampler-shared-layout.slang`.
  G1: commit 1 also fixes #13272 and overlaps #10607 (both jhelferty-nv). G2: assert the silent fall-throughs. G3: the size copy is unpinned.
- 14:37Z I relayed B1 to muhgh6 (msg 103, pin + `in_reply_to=2`, landed as seq 44). Asked: fix it itself, or cherry-pick a standalone
  remedy commit from hgic9q, and pass B1 to its R3 reviewer. 14:3xZ triager msg: have the fixer prepare that standalone commit
  on c94e1d0. G1 links go in the PR body only, with no bot posts on #13272/#10607. #13741's operator reporting stays with `kd4ktm`.
- 14:43Z muhgh6 reproduced B1 at c94e1d0 (seq 47; #13741 cmt 6494651615 edited: blocked) and **chose option 2**: a standalone
  commit from hgic9q, with B1 passed to its R3 reviewer. 14:43Z the fixer pushed **`c1b407836`** (I checked: 2 files, +4/−1 pass + 63-line test).
  Its parent is `097fd07e4a` (the #14017 merge of c94e1d0, not a force-push), so it needs a cherry-pick, not a fast-forward. Local cherry-pick
  9404b015f applied cleanly; 35/35 Debug. 14:4xZ I relayed the SHA to muhgh6 (msg 113, pin + `in_reply_to=2`; it landed as seq 46 at 14:43:47Z, and the listing sorts it below seq 47/48 because ordering is by seq), warning it not to fast-forward.
- 15:2xZ #13741: muhgh6 cherry-picked B1 as `93c3b0499c`; the branch now ends at `fb36938e73`. Its R4 delta review = APPROVE, and the Fix Report was filed (its seq 60/61).
- 15:40Z triager msg 134: #14017 head `015c90b4e1`. R1 is fixed (B1 via c1b407836, G2/G3 in `ec3366af2`, N1–N4), and the body has `Fixes #13272` + a #10607 mention.
  The base was merged twice (no force-push). CI 40902578585 is in progress. **R2 (final) requested.** I relayed an FYI to muhgh6 (pin + `in_reply_to=2`):
  #14017 edits #13741's `gh-13737-nested.slang` (Metal CHECK) and `gh-13737-fold.slang` (comment); I checked both in the compare.
- 16:32Z **#14017 R2 = APPROVE_WITH_NITS** @015c90b (slang-reviewer; `/workspace/inbox/a2a-1793291546332-tdktfu/combined-review.md`).
  No bugs; all R1 items met. G4 is test-only: a combined-sampler array as a direct field, with the attached test
  `combined-texture-sampler-nested-array.slang`. Nits N1–N7 are to be applied without another round. N3: link or file an issue for the pre-existing WGSL `legalizeInst`
  abort on `Sampler2D.Handle`; filing a verified issue is not an operator gate. The reviewer's own runs: 47/47 PR tests; corpus 3,724
  jobs differ only in 10 Metal rows; full suite 10749/10752 (3 fp8-cuda, as on the base).
- 17:15Z **[Triage Resolution] = fixed** (msg 148). #14017 is a draft @8cc701f716 on base `fix/issue-13737`@fb36938e. Fixes #14006/#14007/#13272,
  with #10607 mentioned. R2 nits applied, except N3. The fixer reports the full suite at 10975/10978 (3 fp8). CI 40918070144 @8cc701f is `waiting` on `falcor-ci` (I checked it).
  No new issue posts: fixer comments 6497487123/6497487552 already show the final state.
- 17:1xZ **N3: I authorized it myself** (msg 153). Filing a verified issue is not an operator gate
  ([policy](../imported/feedback_github_writes_operator_authorized.md)). The fixer files ONE issue for the WGSL `Sampler2D.Handle` `legalizeInst`
  abort, after a repro on current master and a dedup (it overlaps #13741 follow-up 7), and links it from the `$q` comment. That is a comment-only push.
  (b)/(c) follow the same rule. Defects that occur only on the stack go into the PR body. The triager relayed this (msg 156).
- 17:2xZ told the operator on the dashboard (thread 14007, table): decisions are the `falcor-ci` approval for 40918070144 and the #14017 ready flip after #13741.
  The one-shot **`rechase-14007-pr14017-4a77`** fires 11-05 08:00Z.
- 17:48Z follow-ups (triager msg 162; I checked through the API that both are open and bot-authored): **#14041** (N3: WGSL `Sample` on a bindless `Sampler2D.Handle`
  aborts in `legalizeInst`; this is also #13741 follow-up 7) and **#14042** ((c): Metal, an unused PB `Sampler2D` field drops its sampler, offset 8 vs 16).
  (b) was not filed, because it did not reproduce in 4 variants. #14041 is linked from the WGSL `$q` comment, so the #14017 head moved to **c1dfa2cae3**. CI is now **40924685979**
  (waiting on `falcor-ci`); 40918070144 was cancelled. **The bot-filed #14041/#14042 belong to THIS chain**; a later `issue_opened` webhook for them needs no dispatch.
  17:5xZ: updated both one-shot prompts (this chain's, and an addendum on `rechase-13737-pr13741-0272` saying follow-up 7 = #14041).
  Sent the dashboard correction about the run id.
- **PARKED on:** the operator (falcor-ci, ready flip), #13741 landing, and maintainer review. **Open:** nothing agent-side.
  **Resumes on:** webhooks (#14017 → fixer via mapping; issue comments → Main), the one-shot, or the operator's answer.
- 17:47Z the fixer filed **#14041** for N3 (WGSL `Sample` on a bindless `Sampler2D.Handle` aborts in `legalizeInst`; repro on master `35fe8acc5`). #14017 cross-references it (timeline 17:47:52Z). The triager reported it to this chain's Main `…h31wzw` (seq 162). The #14041 `issue_opened` webhook minted Main `…k548zt`, which checked ownership and dispatched nothing. The R6 hold does not apply, because the bot filed it. Operator reporting for the N3/(b)/(c) results stays with `…h31wzw`.
- 17:47Z **#14042 `issue_opened` mis-dispatch (Main `…lwjrc1`).** I dispatched a triage without first reading line 104 above, which says this chain owns #14042.
  That dispatch minted triager `…r9kxnu` and, through its handoff, fixer `…l446dg` (thread 14042). At 18:1xZ I told `…l446dg` to hold, with no edits/pushes on `fix/issue-14007`.
  Triage (18:11Z, report at `reports/triage/triage-14042.md`, issue comment 6504637257, label `reproduced`): bug/high/P2, not a regression, **sibling of #13272**.
  The cause is in `lowerCombinedTextureSamplers`: `mapTypeToLoweredInfo` is filled only from top-level params and use sites, so an unused PB field's combined type is never lowered.
  A 3-line discovery fix **alone asserts on master** (legalize-types.cpp:3508, HLSL/WGSL), but on top of #14017's pass it is clean (Release+Debug, Metal/HLSL/WGSL × 5 shapes).
  `fix/issue-13272`@b1fab5e41b also fixes it. The triager recommends folding it into #14017 with `Fixes #14042` + a Metal test. The patch is in the triager's verify worktree `wt-14042-verify`.
  **OPEN decision (operator, asked on the dashboard 10-29 18:1xZ): fold #14042 into #14017?** Folding moves the head, so falcor-ci CI must be re-approved and there is a review delta.
  If yes, the work goes to fixer `…hgic9q` (pinned), never `…l446dg`. The triager also says #13272's supervisor entry ("held on #10607 decision") is stale, because #14017 carries `Fixes #13272`.
  Its CPU-reflection observation (tex@0 size 16, tint@8 overlap, whether or not tex is used) was not acted on.
  18:13Z fixer `…l446dg` confirmed the HOLD (msg 44; it changed nothing). Point that goes into the fold decision: the owner's `memory/fix-14007.md` says it tried eager registration of all combined types
  (= the triager's patch A) and DROPPED it, because "it lowers unused HLSL/WGSL fields that compile today". The triager confirms that HLSL/WGSL `two` output changes (it gains `register(t0)/(s0)`).
  Before any fold, owner `…hgic9q` must reconcile its finding with the triager's. A Metal-scoped discovery may be what's needed.
  18:14Z triager `…r9kxnu` stood down. It edited comment 6504637257 in place, so Next-action now reads "held for a maintainer decision on folding into #14017". It keeps patch A applied in its
  `/workspace/agent/wt-14042-verify` (triager group, Release+Debug built) in case `…hgic9q` asks for it.
