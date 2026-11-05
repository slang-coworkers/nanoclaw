---
type: chain-log
title: slang#13737 / PR #13741 — dated history
description: Dated readings of the #13737 chain (10-17 dispatch → 10-29 R4 APPROVE + final Fix Report); current state, the fix shape, follow-ups and lessons live in the chain record, new dated entries append here
---

# slang#13737 / PR #13741 — dated history

Chain record (state table, fix, 7 follow-ups, lessons): [[slang/13737-hlsl-combined-sampler-texture-only-ops.md]].
New dated entries go **here**, one bullet each. When this file nears 12 KB, prune the oldest "no change" bullets.
Numbers are the fixer's or reviewer's own unless marked "I checked".

## 10-17 → 10-18: triage, R1, R2, nits

- 10-17 15:43Z dispatched to slang-triager; 15:49Z sent prior art #11816 (`$q`, merged 08-18, closed #11669, WGSL only).
  15:55Z triage posted (cmt 6236169441), reproduced on master 60a7c8c88. Triager recommended A (forward through
  `__extractImage(this)` behind `isCombined`), fallback B (extend `$q`).
- 10-18 ~00:29Z draft #13741 @45d7d9f used **B** (A hit E30027). Suite 10929/10932 (3 fp8 CUDA, also on master).
  ~00:55Z asked the operator about follow-ups 1–3.
- 02:17Z **R1 REQUEST_CHANGES** @45d7d9f0a (0 bugs/2 gaps/1 q; diff_hash 4c1f2175…): fix correct, 526×7 corpus diff = 14
  combined-sampler fixes only, WGSL GPU-run OK; required the maintainer's `__getTexture()` resolve → free-function trampoline.
  02:2xZ told the operator follow-up 3 may be weaker.
- ~05:25Z **R2 push** @68f06ed8d (11 commits; new tests `-bindless`, `-cpu`; I checked head, files, cmt 6243760176). Suite 10938/10941.
- 06:59Z **R2 APPROVE_WITH_NITS** @68f06ed8d (0/11/3; diff_hash ab3058f1…): R1 + R3 asks met, 0 regressions (10923/10941, same 18 as
  master), 528×7 corpus only fixes, DXC 0 errors, L40S Dawn + vk/cuda pass, mutation drill catches a missing `$q`.
  CI 39099986886 waited on `falcor-ci`.
- 07:23Z **nits** @ce23b34d9 (+552/−76, 12 files; I checked: comments/docs/tests, a rename, the `$q` assert; no logic change).
  07:35Z [Triage Resolution] = Fixed (msg 48). Follow-ups grew to 5; dedup found none for 4–5. CI 39107456646 waited on `falcor-ci`.
- 10-18 15:12Z Buriola closed #13737 (found on the 10-21 re-check).

## 10-21, 10-24: re-checks, no change

- 10-21 08:0xZ (`-a71d`): #13741 draft `ce23b34`, MERGEABLE, 0 reviews; master +21 (1 overlapping file, `slang-emit-c-like.cpp`).
  No operator answer (dashboard 10-16 23:26Z→10-21 08:01Z); restated the decisions once (dashboard msg id 9).
- 10-24 08:0xZ (`-4d52`): no change; master +55; no operator answer (10-21 00:34Z→10-24 07:30Z); no dashboard line sent.

## 10-29: nested regression, B1, R3, R4

- 10:41Z the #14007 fixer claimed a regression @ce23b34 (Load-only nested combined sampler → assert at
  `slang-ir-legalize-types.cpp:3504`); relayed to muhgh6 (its seq 32).
- 10:50Z **confirmed** by muhgh6 (msg 80; PR cmt 6494651615, I checked): 8 shapes; Debug E99997, Release wrong register. Repro
  files: slang-fixer `/workspace/agent/scratch-13737/r14007-shapes/` (`s8_two.slang`). 10:51Z asked the #14007 triager `…3hlxu4`
  for a standalone commit (msg 87 → fixer `…hgic9q` msg 39); 10:52Z ack to muhgh6 (msg 95 → its seq 34).
- 13:34Z **@`c94e1d07e`** (msg 94; I checked: +881/−76, 15 files; `ca41b168a` fast-forwarded + `gh-13737-nested`). Revert drill
  3/4 rows fail; DXC 9/9. CI 40881150043 (priority yield + `falcor-ci`); 39107456646 cancelled. ~13:40Z my premature falcor-ci note.
- 14:43Z **B1**: c94e1d0 segfaults (rc 139) on `Sampler2D x; cbuffer C { Sampler2D a; float4 c; }` — found by #14017 R1,
  reproduced by muhgh6 (msg 96) and the R3 reviewer. Freed shared `IRVarLayout` at
  `slang-ir-lower-combined-texture-sampler.cpp:345`. Remedy `c1b407836` (parent = #14017 merge `097fd07e4`, so cherry-pick only),
  relayed to muhgh6 by sibling Main `…h31wzw` (seq 46). ~14:5xZ corrected the operator.
- 14:50Z **R3 REQUEST_CHANGES** (delta `ce23b34..c94e1d0`; 1/2/1; diff_hash 6efe1aa2…; review file
  `/workspace/inbox/a2a-1793285426898-ug68mk/combined-review.md`; msgs 108/110). Bug = B1. Reviewer owned that R2 missed the
  nested off-by-one binding. Gaps G1 (→ follow-up 6), G2/G3 (prefix-only / `-NOT`-only checks), C004/C005.
- 15:20Z **@`fb36938e7`** (msg 114; I checked: `93c3b0499` cherry-pick + operand pins). 41/41 targeted (Release + Debug), suite
  10951/10954. CI 40897173994.
- 15:24Z **R4 APPROVE** (delta `c94e1d0..fb36938`; 0/0/0; diff_hash 42b8d748…): 58/58 targeted, revert drill rc 139, DXC t0..t4 =
  reflection, Tint OK. 15:2xZ consolidated operator update sent.
- 15:25Z **final [Fix Report]** (msg 120): 74 behind master; master merge offered and declined (pin + `in_reply_to=120`).
- **10-31 08:0xZ re-check (case e, 3rd silent in a row):** #13741 is still a draft @fb36938, with no human activity on #13737/#10522/#13741 since 10-29 15:30Z
  (only bot cross-refs from #14042/#14073/#14079). Operator: no answer. CI 40897173994 is still `waiting` on falcor-ci (`can_approve=false`); the PR is 95 behind master.
  Withdrew the "which follow-ups to file" ask as over-gated; slang-triager `4emo71` was asked to file 1/3/6 (pin + `in_reply_to=2`, it woke 08:02).
  Dashboard msg 21 says 2 decisions are open, the window ends ~11-28, and the 10-30 proposal to cancel stale bot runs would cancel 40897173994. Re-armed `rechase-13737-pr13741-564d` @11-07 08:00Z.
- 10-31 08:11Z triager `4emo71` [Report] (its seq 29): filed follow-up 1 = **#14123** (`Sampler2DMS.GetSamplePosition`) and 3 = **#14124** (E30027,
  extension method calling a member of the same extension on another specialization); 6 not reproduced on master `c959b561d`. The #14123
  `issue_opened` webhook reached Main 10-31; ownership checked, nothing dispatched.
- **10-31 08:11Z filing report** (triager msg 134; I checked both are live): **#14123** (HLSL `GetSamplePosition` on a combined
  `Sampler2DMS`, follow-up 1) and **#14124** (E30027: an extension method calling a member of the same extension on another
  specialization, follow-up 3; reproduced in user code with a 9-variant table), both labeled `reproduced`. Item 6 (G1) was not
  reproduced on master and not filed. On master the shape gets no binding (#13272) and Debug asserts at `legalize-types.cpp:3508`,
  but master's reflection JSON shows the cause: descriptorTableSlot size 1 in a `ParameterBlock` vs 2 in a `ConstantBuffer`/global.
  08:1xZ I asked the triager (msg 135, pin `4emo71` + `in_reply_to=134`) to **file G1 anyway**, based on that reflection
  inconsistency on master (the consequence after #13741: a duplicate `@binding`; link #13272/#13741/#14017), and **to file the
  side observation** (`GetSamplePosition` body-less intrinsic under `[require(glsl, spirv)]`: invalid GLSL, SPIR-V E29000, plain
  `Texture2DMS` too).
- 10-31 08:15Z the triager filed **#14125** (`GetSamplePosition` on GLSL/SPIR-V, a body-less intrinsic under `[require]`;
  cross-references #14123), which shows msg 135 reached it. The G1 issue is next: the triager is first building fb36938 in its own
  worktree to measure the duplicate binding.
- 10-31 08:15Z triager `4emo71` (its seq 31) filed the side observation as **#14125** (`Texture2DMS.GetSamplePosition`
  declared for GLSL/SPIR-V with no implementation: invalid GLSL, SPIR-V E29000; labels `reproduced`, Bug; cross-ref #14123).
  Its `issue_opened` webhook reached Main 08:16Z; owned by this chain, nothing dispatched. G1 (WGSL ParameterBlock) still in progress.
- 10-31 08:21Z the triager filed **#14126** (WGSL: combined `Sampler2D` in a `ParameterBlock` reserves 1 descriptor slot instead
  of 2). Master repro is the reflection JSON at c959b561d. The duplicate `@binding(1) @group(1)` was measured at fb36938e7 in the
  triager's own worktree; Tint is credited to the review. It links #13272/#13741/#14017/#14042. **Filing done: #14123, #14124, #14125,
  #14126.** Not filed: 2 (`Texture2DMS[uint2]`), 4 (bindless DXIL nonUniformIndex), 5 (CPU float-array GetDimensions); the reviewer
  did not recommend them. 7 = #14041.
- 10-31 the `issue_opened` webhook for **#14126** reached Main; owned by this chain (bot-filed by the triager), nothing dispatched.
- 11-04 04:52Z — new external dup report **#14298** (kovidgoyal, Metal combined `Load`/`operator[]` use the sampler as the coordinate; reproduced on master 139f09f59). Triager checking whether #13741's head fixes it. Record: [14298](14298-metal-combined-sampler-load-subscript-arg-index.md).
- 11-04 05:04Z — #14298 confirmed fixed at fb36938e7 by slang-triager (Metal/WGSL/HLSL). Main pinned-woke owner `muhgh6` (seq 66): add `Fixes #14298` to the #13741 body, body edit only, no push.
- 11-04 05:06Z — fixer [Report] (msg 282): `Fixes #14298` added to the #13741 body. I checked: Fixes = #13737/#10522/#14298; head `fb36938e7`,
  draft, no push. The #14298 chain record is updated.
