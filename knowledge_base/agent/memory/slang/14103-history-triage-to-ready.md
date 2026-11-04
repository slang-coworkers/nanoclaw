---
type: chain-log
title: slang#14103 / PR #14111 — dated history
description: Dated readings of the #14103 chain (10-30 dispatch → 11-02 un-draft) — triage, cascades, R1–R4 peer reviews, the 11-02 redesign and maintainer answers; current state, fix shape and lessons live in the chain record, new dated entries append here
---

# slang#14103 / PR #14111 — dated history

Chain record (state table, fix shape, decisions, lessons): [[slang/14103-parse-command-line-arguments-ignores-errors.md]].
New dated entries go **here**, one bullet each. When this file nears 12 KB, prune the oldest "no change" bullets.

## 10-30 — dispatch, triage, go-ahead

- **20:32Z `issue_opened`.** Human-filed by pdeayton-nv, `bot-ok`. Repro: `parseCommandLineArguments(1, {"-target"}, …)` prints
  `accepted`. Slang v2026.20. Pre-dispatch: no memory hits; Main webhook session was the only one on the thread. Related, not
  duplicates: #8453 (OPEN), #8963 (CLOSED). Orchestrator pointer (master d34a5eb54d): `slang-global-session.cpp:1163` discards
  `processCommandLineArguments`'s `SlangResult`; diagnostics go to the temp request's sink. Dispatched to slang-triager.
- **20:42Z triage** (cmt 6533041941): Bug/medium/P2, `reproduced`, not a regression (since #3598). Rec A: `SLANG_RETURN_ON_FAIL`
  at :1163 + null `*outAllocation` + slang.h note + unit tests. Option B (return diagnostic text) = new API, asked. Newly FAIL:
  `-target`, `-bogus-option`, `-target bogus`, `-profile`, `-stage compute` without `-entry` (E00033), non-adjacent duplicate
  `-target` (E00050). No caller in slangpy/slang-rhi. Memo: inbox `a2a-1793392964572-qg96ni/triage-14103.md`.
- **~20:50Z routing.** Reporter self-assigned 20:32:36Z → no fixer without their go-ahead (same rule as #14101). Triager edited
  its comment (20:48:12Z) with the E00033/E00050 rows and the assignee question; one-shot `recheck-14103-assignee-79b9` set.
- **21:20:58Z GO** ([cmt 6533708092](https://github.com/shader-slang/slang/issues/14103#issuecomment-6533708092)): "please generate a
  draft PR / Let's not worry about a new API for the diagnostic text". Option B out of scope. Routed through the triager.
- **21:23–21:26Z.** Fixer acked (worktree `wt-slang-14103`, base e638298fe). Triager handed off, cancelled the recheck, posted a
  fresh delta cmt 6533791303 — overriding my "update in place", correctly (the reporter had commented since).
- **22:26Z cascade** (fixer): Fix A regresses `tests/compute/mutating-methods.slang` (removed `-serial-ir`, E00017 — a masked
  test bug, arg dropped) and the two `-floating-point-mode precise` NaN tests (zero-target "ignored" diagnostics). I verified
  the parser keeps default-target options for a later `addCodeGenTarget()` (slang-options.cpp:5066-5072 →
  slang-end-to-end-request.cpp:1342), so "ignored" is false outside slangc. Ruling 22:3xZ: gate on the existing
  `m_isCommandLineCompile` (slangc main.cpp:25) — I said "cover both" diagnostics, which R1 showed wrong for profiles.
- **23:4xZ draft PR #14111** @8c2926caea, 7 files, 5 commits; commit 2 (5ed82ade5) keys the render-test device cache by global
  session — a third masked failure (`std-lib-serialize.slang.4`). Suite 11333/11336 (fp8-cuda pre-existing). Explanation cmt
  6535595823. The triager's "no change" table had missed all three breaks.

## 10-31 — peer reviews R1/R2, first park

- **00:26Z R1 REQUEST_CHANGES** @8c2926cae (inbox `a2a-1793406367305-cyzghb/combined-review.md`, not posted). B1 🔴: gating
  E00042 hides conflicting default-target profiles and a lone non-inferring profile that `Linkage::addTarget` overwrites
  (slang-session.cpp:201). Remedy: keep E00042, gate only E00044. G1 slangc test, G2 four API rows, N1–N4.
- **00:59Z R1 fixes** @27a627a073 (fast-forward); new `target-flags-ignored.slang`; suite 11335/11338.
- **01:06Z R2 APPROVE** @27a627a07, 0 findings. **01:12Z Triage Resolution**; parked on pdeayton-nv; Main one-shot
  `recheck-14111-ready-af0a` 11-04 01:15Z; decision sent to orchestrator-dashboard.

## 11-02 — redesign, R3/R4, maintainer answers, un-draft

- **04:52Z REOPENED** ([cmt 6569366135](https://github.com/shader-slang/slang/pull/14111#issuecomment-6569366135)): define the API
  contract, split session vs compile checks rather than suppress diagnostics, purpose enum suggested, accept
  `-target dxil -profile cs_6_0`, keep `-o` inference, document in slang.h, test via `createSession`. Fixer agreed (cmt
  6569397830). R2 superseded. My notes: the E00044 gate is the rejected suppression; keep R1 B1; ask about `-target hlsl -o foo.spv`.
- **06:35Z/07:01Z** heads 9fa0034 (`CommandLineParsePurpose`) and 4972b71069. pdeayton-nv's 2nd direction
  ([cmt 6570770007](https://github.com/shader-slang/slang/pull/14111#issuecomment-6570770007)) answered the `-o` question.
- **08:09Z R3 REQUEST_CHANGES** @4972b7106 (inbox `a2a-1793606960683-azibmb/`): B1 🔴 session target kept the profile's stage
  (E36107 on VS+CS); G1 E00045 widened in all purposes; G2 undisclosed `GenerateWholeProgram` removal; G3 weak fp test.
  Ruling: version-only remedy + ask Q1; E00045 session-only + ask about slangc; fix G2/G3.
- **08:19–08:42Z rework.** FG006 suppression dropped as dead code (my 08:2xZ ask was wrong once G1 was session-only); the
  fixer retracted the `compute+spirv_1_5` case.
- **09:28Z R4 APPROVE** @4161c93b91; questions cmt [6573348944](https://github.com/shader-slang/slang/pull/14111#issuecomment-6573348944);
  suite 11154/11157. 09:35Z Triage Resolution (11 files, +1304/−440, 23 commits).
- **18:25Z answers** ([cmt 6584940812](https://github.com/shader-slang/slang/pull/14111#issuecomment-6584940812)): Q1 version-only
  intended, keep explicit capabilities; G1 → "Please open an issue". Fixer filed #14195 at 18:41Z; jkwak-work self-assigned
  18:47Z. No dispatch for #14195.
- **18:51Z** test-only commit @cd923c72da (`-capability spirv_1_6` / `glsl_450+spirv_1_6` = `TargetDesc` SPIR-V); no extra
  peer round (triager and I agreed). Issue cmt 6533791303 → "Blocker: None".
- **19:21:56Z un-drafted** by pdeayton-nv + review requested. 21:1xZ: 56 pass / 0 fail / 2 pending; BLOCKED (no review).
  Approver paused → queued in `data/approver-pause-queue.md`, not forwarded. Recheck updated.
- **11-04 01:16Z** one-shot `recheck-14111-ready-af0a` fired: #14111 MERGED 11-03 21:05:19Z (`f1cd35ff8`), #14103 closed as completed, fixer close-out row 79. Approver-queue entry marked merged. Chain terminal, with no further timer.
