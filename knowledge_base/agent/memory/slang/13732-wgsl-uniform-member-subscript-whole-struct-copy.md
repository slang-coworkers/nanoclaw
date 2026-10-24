---
type: chain
title: slang#13732 — WGSL whole-uniform-struct copy for a member subscript call
description: Human-filed (albertrodriguezclo) WGSL codegen perf issue; routed to slang-triager 2026-10-17
---

# slang#13732 — WGSL: member subscript on a uniform struct copies the whole struct

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
    My one-shot re-check `rechase-13732-pr13734-54b2` (moved to 2026-10-21 15:00Z on 10-19).
- 2026-10-19 21:34Z: the reporter answered on the issue
  ([6277854047](https://github.com/shader-slang/slang/issues/13732#issuecomment-6277854047)). The
  comment has no bot mention; it arrived as a `pr_mention` webhook anyway. Per the reporter, #13734 now
  keeps attributed loads whole (19095d9e5, the `deferBufferLoad` rule) and the new
  `tests/optimization/buffer-load-partial-member-loads-attributes.slang` (28bf262e9) covers both of
  the triager's examples. I verified live: head 28bf262e96 (commits 888205405 → 312e4193b, 19095d9e5,
  cab0e48f2, 28bf262e9); the two cited commits touch the files the reporter names; CI is 5 pass and
  1 pending; there is no human maintainer review yet.
  - I asked slang-triager to re-verify on 28bf262e96 and post a follow-up (pinned to its owner session
    `sess-1792248984408-me86v2`, msg 31, in_reply_to 18). I updated the re-check `-54b2` with the new
    decision table and moved it to 10-21 15:00Z. No fixer.
- 2026-10-19 21:47Z triager `[Report]` (their findings): attribute fix verified at 28bf262e96. Both of
  their examples give the same SPIR-V as master. Revert drill: without the guard
  (`slang-ir-lower-buffer-element-type.cpp:1268-1272`) the new attributes test passes 1/3; with it, 3/3.
  The repro and its 12 variants copy only the member. Subset: 1276/1276 on the PR, 1270/1270 on master
  837ab4c34. Follow-up comment
  [6278114155](https://github.com/shader-slang/slang/issues/13732#issuecomment-6278114155) (verified:
  nv-slang-bot). Verified live: the PR is OPEN, `BEHIND` master, assigned kaizhangNV and
  albertrodriguezclo, with a review requested from dshreiner-nv; the issue is assigned to jkwak-work.
  **Now waiting on maintainer review; the triager only watches.** Re-check `-54b2` on 10-21 15:00Z is unchanged.
- 2026-10-21 15:00Z re-check `-54b2` (live read): the PR is OPEN and not merged. The head **moved to
  ae4db91cd7** ("Member loads: load each member once, move a read across a branch only in bounds",
  pushed 10-19 22:25Z, after the triager's 21:47Z verify). The reporter answered the github-actions[bot]
  review on 28bf262e96 (🔴 0 bugs, 1 gap: no test for the read moved across a branch) with 10 inline
  replies at 22:29–22:30Z (new `guardedConstantIndex` case, `isKnownAvailableAt` rename, shared
  `hasWholeAccessAttr` in slang-ir-util). It is `BEHIND` master, CI is 7/7 pass, and there are still no
  human maintainer reviews (dshreiner-nv still requested). No issue comments since 6278114155. The
  triager session was idle since 21:47Z.
  - Decision row (4): I asked slang-triager to re-verify ae4db91cd7 and edit 6278114155 in place
    (pinned to `sess-1792248984408-me86v2`, thread `gh-issue-shader-slang/slang-13732`, a2a msg id 7).
    No fixer and no approver. Re-check `-54b2` was consumed by this fire, so the successor `rechase-13732-pr13734-ae-bd35` (one-shot, 10-23 15:00Z) is keyed on ae4db91cd7.
- 2026-10-21 15:26Z triager `[Report]` (their findings): no regression at ae4db91cd7. The attributed
  loads match master 045300d41 at -O0 and -O1. Revert drill on `hasWholeAccessAttr(load)` (:1309): 1/5
  with it disabled, 5/5 restored. `guardedConstantIndex` plus the cross-block gate (:1323-1328) are
  covered by the GUARD case. Untestable gap: the literal in-bounds check (the front end rejects it
  first, E30029). Subset 1280/1280 on the PR; merged locally onto master 045300d41 (incl. #13715,
  same file) it is conflict-free and passes 1295/1295. Comment 6278114155 was edited in place
  (verified: updated_at 15:25:49Z, still the newest comment). PR is OPEN, `BEHIND`, and dshreiner-nv
  is still requested. Still parked on maintainer review; successor re-check `-ae-bd35` on 10-23 15:00Z.
- 2026-10-23 15:00Z re-check `-ae-bd35` (live read): no change. The PR is OPEN and not merged. The head is still
  ae4db91cd7. It is `BEHIND` master, CI is 7/7 pass, and dshreiner-nv is still the requested reviewer. There is
  no human maintainer review: all reviews are from coderabbitai, github-actions, or the author. There are no issue
  or PR comments since 10-21 15:00Z. The triager's re-verify of ae4db91cd7 is on GitHub: comment 6278114155 was
  edited in place, updated_at 10-21 15:25:49Z, and it names ae4db91cd7.
  - Decision row (2): I sent one row to orchestrator-dashboard (thread `gh-issue-shader-slang/slang-13732`) to say
    the PR is waiting on maintainer review. I did not message the triager, dispatch the fixer, or contact an approver.
    Successor one-shot `rechase-13732-pr13734-ae-26` runs on 10-26 15:00Z.
