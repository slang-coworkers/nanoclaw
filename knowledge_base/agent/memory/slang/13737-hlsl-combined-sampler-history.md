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
