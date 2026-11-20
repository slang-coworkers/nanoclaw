---
type: chain-log
title: slang#13732 / PR #13734 - dated re-chase history (2026-10-17 -> 11-16)
description: Dated readings and decision rows of the #13732 chain - triage bisect, the 28bf262e96/ae4db91cd7/cb4ad5253a verifies, the re-check series and the auth-outage no-reads. Terminal state, findings and next re-check live in the chain record; new dated entries append here.
---

# slang#13732 / PR #13734: dated re-chase history

Chain record (state, findings, next re-check): [[13732-wgsl-uniform-member-subscript-whole-struct-copy.md]].
New dated entries go **here**. When this file nears 12 KB, condense the oldest "no change" readings to one line each.

## 2026-10-17: filing, triage, and the reporter's PR

- Filed 2026-10-17 14:54Z by albertrodriguezclo (same reporter as #13631–#13690). No labels or
  assignee. On WGSL, `push.b[i]` (a `__subscript` getter on member `b` of `uniform Push push`)
  emits `var _S3 : Push_std140_0 = globalParams_0.push_0;` then `&(_S3.b_0)`. The reporter expects a
  member-only copy, which Slang already picks when `Push` also has a `float4 big[8]` member. The
  ideal is no copy for a getter that does not mutate `this`. Related to #13703 (large `in` struct
  params by value on WGSL; chain `awaiting_human`).
- 2026-10-17 ~15:00Z: live read clean (open, 0 comments, updated_at == created_at, body 1799
  chars). Dispatched to slang-triager on `gh-issue-shader-slang/slang-13732`. No fixer until the
  triage memo comes back and a go-ahead exists.
- 2026-10-17 15:34Z triager progress (their finding): reproduces on master 60a7c8c88; regression
  since v2025.19, first bad e420f2f98 (#8668, "Defer `IRCastStorageToLogicalDeref` in
  lowerBufferElementType pass", subject verified by me). The reporter opened **PR #13734** at 15:25Z
  (verified: open, ready, branch `fix/wgsl-uniform-member-partial-load`, `Fixes #13732`). The triager
  says it takes the producer-side approach they would recommend and is building it to verify. A
  human PR owns the fix, so no fixer dispatch. Its review events route as a human PR (approvers paused).
- 2026-10-17 15:52Z `[Triage]`: regression (codegen quality, no wrong results), P2, IR
  buffer-element lowering → WGSL (also SPIR-V -O0). Bisect v2025.18.2 good → v2025.19 bad, first bad
  e420f2f98 (#8668); parent 3cf1f5a61 good. Mechanism (triager's finding): the `deferBufferLoad` size
  gate (>16 B and (>128 B or has array), `slang-ir-defer-buffer-load.cpp:59-92`) hides it for
  `float4 big[8]`; otherwise the `kIROp_Load` case of `lowerBufferElementTypeToStorageType` copies
  the whole value and passes `&tmp.b`. Options: A member-only loads (recommended, = PR #13734), B relax
  the gate (all targets), C zero copy (design follow-up).
  - Public comment [6236090926](https://github.com/shader-slang/slang/issues/13732#issuecomment-6236090926)
    (verified: nv-slang-bot, only comment); labels `regression`+`reproduced`, Type=Bug (verified).
  - Triager built #13734 @888205405a: fixes all variants, Dawn validates, memory-op order kept, new test
    fails master / passes PR (+ Vulkan L40S), subset 1271/1271. **Problem:** member loads drop
    `IRAlignedAttr`/`IRMemoryScopeAttr` (coherent load loses `MakePointerVisible|NonPrivatePointer`).
    The ask to the reporter (keep the deferBufferLoad guard at :230-244 + a test) is in the issue comment's
    Next-action. It is not on the PR thread itself (PR has only bot comments).
  - Memo: `/workspace/inbox/a2a-1792252322688-2vpl00/triage-13732.md`. No fixer. The triager watches #13734.

## 2026-10-19 -> 10-21: attribute fix verified at 28bf262e96, then ae4db91cd7

- 2026-10-19 21:34Z: the reporter answered on the issue
  ([6277854047](https://github.com/shader-slang/slang/issues/13732#issuecomment-6277854047)). The
  comment has no bot mention; it arrived as a `pr_mention` webhook anyway. Per the reporter, #13734 now
  keeps attributed loads whole (19095d9e5, the `deferBufferLoad` rule) and the new
  `tests/optimization/buffer-load-partial-member-loads-attributes.slang` (28bf262e9) covers both of
  the triager's examples. I verified live: head 28bf262e96 (commits 888205405 → 312e4193b, 19095d9e5,
  cab0e48f2, 28bf262e9); the two cited commits touch the files the reporter names; CI is 5 pass and
  1 pending; there is no human maintainer review yet. I asked slang-triager to re-verify on 28bf262e96
  and post a follow-up (pinned to its owner session `sess-1792248984408-me86v2`, msg 31, in_reply_to 18).
- 2026-10-19 21:47Z triager `[Report]` (their findings): attribute fix verified at 28bf262e96. Both of
  their examples give the same SPIR-V as master. Revert drill: without the guard
  (`slang-ir-lower-buffer-element-type.cpp:1268-1272`) the new attributes test passes 1/3; with it, 3/3.
  The repro and its 12 variants copy only the member. Subset: 1276/1276 on the PR, 1270/1270 on master
  837ab4c34. Follow-up comment
  [6278114155](https://github.com/shader-slang/slang/issues/13732#issuecomment-6278114155) (verified:
  nv-slang-bot). Verified live: the PR is OPEN, `BEHIND` master, assigned kaizhangNV and
  albertrodriguezclo, with a review requested from dshreiner-nv; the issue is assigned to jkwak-work.
  **Now waiting on maintainer review; the triager only watches.**
- 2026-10-21 15:00Z re-check (live read): PR OPEN; head moved to **ae4db91cd7** ("Member loads: load each
  member once, move a read across a branch only in bounds", pushed 10-19 22:25Z). The reporter answered the
  github-actions[bot] review on 28bf262e96 (🔴 0 bugs, 1 gap: no test for the read moved across a branch) with
  10 inline replies (new `guardedConstantIndex` case, `isKnownAvailableAt` rename, shared
  `hasWholeAccessAttr` in slang-ir-util). I asked slang-triager to re-verify ae4db91cd7 and edit 6278114155
  in place (pinned to `sess-1792248984408-me86v2`, a2a msg id 7).
- 2026-10-21 15:26Z triager `[Report]` (their findings): no regression at ae4db91cd7. The attributed
  loads match master 045300d41 at -O0 and -O1. Revert drill on `hasWholeAccessAttr(load)` (:1309): 1/5
  with it disabled, 5/5 restored. `guardedConstantIndex` plus the cross-block gate (:1323-1328) are
  covered by the GUARD case. Untestable gap: the literal in-bounds check (the front end rejects it
  first, E30029). Subset 1280/1280 on the PR; merged locally onto master 045300d41 (incl. #13715,
  same file) it is conflict-free and passes 1295/1295.

## 2026-10-29: head moved to cb4ad5253a (force-push rebase) + verified

- 2026-10-23 and 10-26 15:00Z re-checks: no change (OPEN at ae4db91cd7, `BEHIND`, dshreiner-nv
  still requested, no human maintainer review, no new comments; 6278114155 still newest, naming ae4db91cd7).
- 2026-10-29 15:00Z re-check (live read): **head moved to cb4ad5253a**. PR OPEN, not merged, `BEHIND`.
  - Maintainer activity (no review or comment yet): on 10-27 19:59:10Z **jkwak-work force-pushed the branch**
    (rewrote the six earlier commits; 2969c15569 now has the ae4db91cd7 subject), added `pr: non-breaking`
    at 20:06:41Z. On 10-28 15:43–15:48Z **jhelferty-nv asked jkwak-work for a review and removed dshreiner-nv**.
  - Reporter commits: 15d5ec38b0 (10-28 00:15Z) changes `emitCopyLogical` in the SPIR-V emitter, widening
    the scope beyond the IR pass. The reporter's comment 6457463415 says this emitter bug already exists on
    master and caused a -O0 spirv-val failure in `buffer-load-partial-member-loads-attributes`. cb4ad5253a
    (10-28 15:04Z) is a test that answers coderabbit r4393566027. No one mentioned @nv-slang-bot.
  - I asked slang-triager to re-verify cb4ad5253a, test the reporter's "master emits the same SPIR-V" claim
    with a revert drill on 15d5ec38b0, compare 2969c15569 against ae4db91cd7, and edit 6278114155 in place
    (pinned to `sess-1792248984408-me86v2`, thread `gh-issue-shader-slang/slang-13732`, in_reply_to = my
    task row seq 2; a2a msg id 9 — reached the pinned session, which woke and wrote seq 23 at 15:03:15Z).
- 2026-10-29 15:23Z triager `[Report]` (their findings): no problem at cb4ad5253a.
  - The force-push is a pure rebase onto 9a4817c881 (range-diff all `=`, same patch-id as ae4db91cd7).
  - The reporter's claim is true: master 01dcd3568 also stores the coherent copy with
    `MakePointerAvailable|NonPrivatePointer` into a Function var, and spirv-val rejects it.
  - 15d5ec38b ("a logical copy's store does not take the source load's attributes", 22-line emitter
    change) is principled, because `IRCopyLogical` attributes only come from the source load
    (slang-ir.cpp:5688).
  - Revert drill with validation on: 3/5. Without validation the test passes 5/5, so it catches the bug
    only through spirv-val (which CI runs).
  - Subset 1324/1324 on the PR, 1350/1350 on master.
  - Verified by me: comment 6278114155 edited at 15:22:35Z, still newest; PR OPEN at cb4ad5253a with
    8 commits incl. 15d5ec38b; CI 6 pass 1 skipping; `BEHIND`; jkwak-work requested.
  - **Side finding, unfiled, operator call:** on master, struct `storeCoherent<16, MemoryScope::Device>`
    through a `Big*` splits into member `OpStore`s with only `Aligned`. The coherent flags are lost
    (a scalar store keeps them). Pre-existing and unrelated to #13734. The probe is in the triager's
    workspace: `scratch-13732/store-coh2.slang`. Asked the operator on the dashboard 10-29 (seq 65,
    Main session `sess-1792248849265-73m1n3`) and repeated once 11-05 (seq 511348) — no answer either
    time; do not ask again, leave it to the operator.


## 2026-11-01 -> 11-16: parked on maintainer review; no-change re-checks; auth outage

- 2026-11-01 15:00Z re-check: no change (OPEN at cb4ad5253a; `mergeStateStatus` BLOCKED, `mergeable`
  MERGEABLE; full CI matrix SUCCESS; only activity a github-actions `deployed` event 10-30, actor
  albertrodriguezclo). 11-05 and 11-08 15:00Z re-checks: no change (OPEN at cb4ad5253a, `BEHIND`,
  52 checks pass, 1 pending `falcor-build-approval-gate` env gate, CodeRabbit skipping; jkwak-work
  still the requested reviewer; no human maintainer review — newest review the author's at 10-28
  15:04Z; no issue/PR/review comments or timeline events; 6278114155 unchanged since 10-29 15:22:35Z,
  names cb4ad5253a; issue #13732 OPEN, assigned to jkwak-work). Dashboard rows were sent at the 7-day
  mark (11-05) and the 14-day mark (11-08, marked unverified); none at 3/10-day marks.
- 2026-11-16 04:40Z re-check (the 11-12 15:00Z fire, which ran 3.5 days late): **live read blocked, so
  GitHub state is UNVERIFIED.** `gh` gets HTTP 401 Bad credentials (GH_TOKEN invalid); plain `curl`
  through the proxy also 401; the slang-mcp GitHub tools return empty or error. A sibling Main session
  posted the auth-down alert (OneCLI `app_not_connected`) at 04:41Z, dashboard seq 512357, so no second
  alert was posted. The last verified state is still 11-08 15:00Z. I sent one dashboard row (thread
  `gh-issue-shader-slang/slang-13732`) marked unverified, pointing to seq 512357 for the outage. The
  successor one-shot re-check runs on 11-19 15:00Z (the 21-day mark); its prompt row (0): if auth is
  still down, retry 1 day out with no dashboard row.

## 2026-11-19 15:00Z - 21-day re-check (GitHub auth restored; case 2, nothing changed)
- PR #13734: OPEN, not merged, head unchanged `cb4ad5253a`; `mergeable_state` now **dirty** (merge conflicts with master; 11-08 read was BEHIND) - master moved past a clean rebase. No new reviews (only coderabbitai[bot]/github-actions[bot]/author, all <=10-28), no issue/PR/review comments since 10-30, timeline silent since 10-30.
- Issue #13732: OPEN, assigned jkwak-work. Comment 6278114155 updated_at 10-29T15:22:35Z, still names current head cb4ad5253a - no edit needed.
- Side finding (storeCoherent<16,Device> through Big*): no operator answer in dashboard rows through 11-19 (asked 10-29 seq 65, 11-05 seq 511348); not re-asked, not filed, per standing rule.
- Sent the weekly 21-day dashboard row (orchestrator-dashboard, thread gh-issue-shader-slang/slang-13732). Successor one-shot scheduled ~11-22; dashboard rows weekly only (next 11-26).
