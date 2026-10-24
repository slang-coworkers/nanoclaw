---
type: chain
title: slang#13739 — WGSL/Metal ByteAddressBuffer.Load<T> keeps every word load when one field is used
description: Human-filed (albertrodriguezclo) WGSL/Metal/HLSL codegen-quality issue; routed to slang-triager 2026-10-17
---

# slang#13739 — WGSL/Metal: `ByteAddressBuffer.Load<T>` keeps dead word loads

- Filed 2026-10-17 17:18:49Z by albertrodriguezclo (same reporter as #13631–#13690, #13732, #13733).
  On WGSL/Metal (and HLSL for struct loads), `Load4`/`Load<M>` is lowered to one u32 word load per
  4 bytes plus a constructor. When only one field is used, the bitcasts and constructor are removed
  but the word loads stay, at -O0..-O3 (17 loads for a 17-word struct; SPIR-V/GLSL read 1). The
  reporter says an unused scalar `Load<uint>` is removed, so the loads the lowering creates are not
  removed by any later pass. Impact cited: 53 x 294 word loads in one kernel, ~1/3 of DXC compile
  time after Tint. Related per reporter: #13732/#13734, #13703.
- 2026-10-17 ~17:20Z: live read clean (open, 0 comments, no labels, updated_at == created_at,
  body 2580 chars). Only session on the thread is my own webhook session. Dispatched to
  slang-triager on `gh-issue-shader-slang/slang-13739`. No fixer until the triage memo is back.
- 2026-10-17 18:02Z `[Triage]`: Bug (codegen quality, no wrong output), P2, IR side-effect
  classification used by DCE. Affects WGSL, Metal, HLSL, CUDA, CPU; SPIR-V/GLSL are fine because their
  leaves are `StructuredBufferLoad`. Not a duplicate. **Independent of #13732/#13734**: the triager
  built #13734 @888205405 and got the same counts as master.
  - Root cause (triager's finding; I checked that `StructuredBufferLoad`/`RWStructuredBufferLoad`/`Load`
    are in the side-effect-free list of `IRInst::mightHaveSideEffects` on master 60a7c8c88 and that
    `ByteAddressBufferLoad` is not): DCE (`slang-ir-dce.cpp:512`) keeps every leaf load that
    `legalizeByteAddressBufferOps` emits.
  - Options: **A (recommended)** add `case kIROp_ByteAddressBufferLoad:` to that list; B narrow leaves in
    the BAB pass (hides the classification bug); C translate to SB ops (not possible).
  - Probe of A (scratch worktree, not a PR): vec 4→1, struct 17→1, subscript 34→2; load-before-aliasing-
    store order kept. Full slang-test 10901/10923; 3 probe-only failures are FileCheck shape (named temps
    now folded into their single use): tests/metal/byte-address-buffer.slang,
    tests/compute/byte-address-buffer-array.slang, tests/compute/byte-address-buffer-aligned.slang.
  - Public comment [6238219006](https://github.com/shader-slang/slang/issues/13739#issuecomment-6238219006)
    (verified: nv-slang-bot, only comment); `reproduced` + Type=Bug (verified). Its Next-action: a maintainer
    decides who makes the fix.
  - Memo: `/workspace/inbox/a2a-1792260174574-wh6eda/triage-13739.md`. **No fixer** (verified: no
    slang-fixer session on the thread). Same reporter usually opens their own PR (#13647, #13734, #13735).
  - Parked on: who fixes it (maintainer / reporter PR / operator release of slang-fixer). One-shot re-check
    `rechase-13739-fixer-deci-60dd` at 2026-10-20 18:00Z.
- 2026-10-19 16:19Z: jkwak-work assigned themself and added `Metal` + `WebGPU` labels (verified via
  issue events). No maintainer comment.
- 2026-10-20 12:42Z: **the reporter opened PR #13764** ("Treat ByteAddressBufferLoad as side-effect free…",
  branch `fix/byte-address-load-side-effect-free`, head `0ec0a72e9b`, ready, `Fixes #13739`) and commented
  "Fix in #13764." (cmt 6291098354, no @-mention). Verified: the core change is exactly option A (one
  `case kIROp_ByteAddressBufferLoad:` in `mightHaveSideEffects`), plus 2 new tests (unused-words,
  load/store order) and the 3 CHECK relaxations the triager predicted. CI 4 pass / 3 pending, 0 reviews,
  no labels on the PR. A human PR owns the fix: no fixer. Asked slang-triager to verify it.
  Re-check `rechase-13739-fixer-deci-60dd` (10-20 18:00Z) repointed at the PR.
- 2026-10-20 13:11Z `[Report]` (triager): **#13764 @0ec0a72e9 passes every acceptance criterion** (built side by
  side with base 7251cc60b = master). Base→PR: vec wgsl/metal 4→1 (hlsl 1, native `.Load4`); struct
  wgsl/metal/hlsl 17→1; subscript 34→2. Load before an aliasing store kept. New tests fail on master (text
  runs) and pass on the PR; full suite 10950/10968, failures = the same 10 env files. Metal
  `buffer_0`→`buffer_1` note is in the PR output too; harmless (same buffer), untraced. No GitHub post
  (verified: PR has only github-actions + coderabbit comments; issue still 2 comments).
  - CI (verified): CI, Check Formatting, REUSE, Verify PR Labels are `action_required` (maintainer must
    approve); 0 reviews; PR has no `pr:` label.
  - **Side observation, UNFILED, operator call:** with the change, an empty spin-wait
    `while (flag.Load<uint>(0) == 0) {}` on a `globallycoherent RWByteAddressBuffer` is removed as a
    side-effect-free loop (wgsl/metal/cuda/hlsl). Master already does this for a `globallycoherent
    RWStructuredBuffer` on every target, so the PR makes BAB match SB; the cause is the existing loop rule
    treating non-atomic loads as side-effect free. Not a defect of #13764. Asked the operator once
    (10-20) whether to file it separately; do not re-ask.
  - Re-check `rechase-13739-fixer-deci-60dd` moved to 10-23 15:00Z (CI approval / review stall check).
  - Triager worktrees: /workspace/agent/wt-13764, wt-13764-base (clean up after merge).
- 2026-10-23 15:00Z re-check (`rechase-13739-fixer-deci-60dd`, all read live): PR #13764 is OPEN with a **new head
  `b4f6056a08`**. That head is `0ec0a72e9b` plus 2 master merges by jkwak-work (`d86ef271d2` 10-22 16:45Z, `b4f6056a08`
  18:53Z → master `e485e78611`). Label `pr: non-breaking` added.
  - **jkwak-work APPROVED** on 10-22 00:46Z ("revisit the memory aliasing later. Looks good to me.").
  - The merge queue failed twice (runs 39714766320, 39772089784) on `tests/wgsl/byte-address-buffer-load-half.slang`.
    That test came from #13647 (merged 10-21) and expects separate `_S<n> : u32` word temps, which the PR now folds
    into their single use. nv-slang-bot posted a diagnosis (cmt 6342865236, from session `sess-1792636777666-efoxhm`
    on thread `gh-pr-shader-slang/slang-13764`).
  - PR CI on `b4f6056a08` (run 39835336499): **FAILED** on all 11 `test-slang` legs plus `check-ci`; Formatting,
    REUSE and Labels pass. I did not check whether the half test is the only failure.
  - jkwak-work posted a replacement `CONST` block for the test on 10-23 01:57Z (cmt 6355543437). It is not on the
    branch yet. The reporter or jkwak-work must apply it.
  - Action: asked slang-triager (thread gh-issue-shader-slang/slang-13739) to re-verify on `b4f6056a08`, list
    the CI failures, and test jkwak-work's diff locally. No GitHub post, no push. No dashboard row (per the
    re-check table) and no new re-check scheduled. The next wake is the triager's report.
  - 10-23 15:03Z triager (interim): the PR diff against the new merge base `e485e7861` has the same hunks as
    `0ec0a72e9` (the one `mightHaveSideEffects` case + the same 5 test files), so the merges did not change it.
    wt-13764-base had been removed by someone else; the triager re-created it. Builds are running (about 20 min).
    Still waiting on: the CI failure list and the result of jkwak-work's CONST diff.
- 2026-10-23 15:12Z `[Report]` (triager): **#13764 re-verified at `b4f6056a0`; the fix is still correct.**
  - The diff against merge base `e485e7861` matches `0ec0a72e9` hunk for hunk.
  - All acceptance criteria re-pass: vec 4→1, struct 17→1, subscript 34→2, a load before an aliasing store is kept,
    and the new tests fail on base and pass on the PR.
  - CI 39835336499: every `test-slang` leg fails ONLY `tests/wgsl/byte-address-buffer-load-half.slang.1`, the
    stale CONST run. There are no other failures.
  - jkwak-work's CONST block (cmt 6355543437) applies cleanly and passes 4/4 on the PR. Two mutation tests show it
    still pins the 0/16 shifts.
  - **Parked on a human action:** the reporter or jkwak-work applies that block, then re-runs CI or re-enqueues.
    There is no compiler-side blocker. No GitHub post.
  - Triager scratch: /workspace/agent/scratch-13764/v2/. Someone else removed wt-13764-base twice (the triager
    re-created it); clean up wt-13764, wt-13764-base and scratch-13764 after merge.
  - The old one-shot `rechase-13739-fixer-deci-60dd` is spent. A new one-shot `rechase-13739-const-bloc-b084` is set for 10-27 15:00Z.
