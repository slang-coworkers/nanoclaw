---
type: chain-log
title: slang#14259 — dated history (triage → four PRs)
description: Dated readings of the #14259 chain from 11-03 triage through the 11-09 fourth PR #14416. Covers the maintainer redirects, the relays and corrections, and the side finds. Current state, the PR table and lessons live in the chain record. New dated entries append here.
---

# slang#14259 — dated history

Chain record (current state, PR table, side finds, lessons): [[slang/14259-hlsl-byte-address-store-double-untyped.md]].
New dated entries go **here**, one bullet each. Condensed 2026-11-09 (OKF fold): the details of each side find live in its own chain file.

## 11-03 → 11-04: triage, PR #14276, the first side finds

- **11-03 21:35Z** `issue_opened` (human, no labels). Dedupe by GitHub search and memory grep found nothing (the memory hits were session-ID
  substrings). Dispatched to slang-triager 21:37Z.
- **21:56Z TRIAGED** bug/high/P2 (target-emit HLSL); not a regression (same in v2026.13.1); cmt 6616391526, labels Type=Bug + `reproduced`.
  - The root cause is in emit, not upstream, because the operand is a double FloatLit. The generic store `.Store(` is untyped
    (slang-emit-c-like.cpp:3133).
  - The HLSL override's uint fast path is dead: it reads the void `getDataType()` (slang-emit-hlsl.cpp:1505). Only `float` literals get a
    suffix, and `Store<half>` is hit too.
  - Side find: the operand order at slang-ir-insts.lua:1336 makes `getValue()` return the alignment (0 users).
  - Recommended fix A types the HLSL override from the value operand and emits `.Store<T >(` for non-uint. The literal-suffix option (B)
    overlaps #14161 and PR #13927, so it is follow-up only.
  - The triager handed it to slang-fixer directly (fixer sess-1793742971321-k0j5bx). Memo:
    /workspace/inbox/a2a-1793743013793-0wjvev/triage-14259.md.
- **~23:25Z DRAFT PR #14276** (`fix/issue-14259` @ b2fb18493, `Fixes #14259`), cmt 6618078546.
  - Its scope also covers the C++/CUDA `Store<double>` of non-literal constants, which is wider than the brief.
  - Test `gh-14259-byte-address-store-typed` fails 5/6 on master. Open risk: FXC (SM 5.x) has no templated `Store`.
- **11-04 00:16Z** slang-reviewer R1: REQUEST_CHANGES. 🔴 L-B1: DXC rejects a templated ROV `Store<T >`; a tested remedy patch went to the fixer.
- **00:40Z** the triager filed two side finds (Bug + `reproduced`, not routed). Their sibling Main `issue_opened` sessions own dispatch:
  [#14282](14282-hlsl-rov-bab-templated-load-dxc-reject.md) (ROV `Load<T>`, DXC rejects it; sess-1793752763678-y82qfn) and
  [#14283](14283-cpu-cuda-bab-store-bool-one-byte.md) (CPU/CUDA `Store<bool>` writes 1 byte; sess-1793752764950-1glnq5).
- **01:48Z [Triage Resolution]** draft #14276 @ 860cc7501 (8 files, +253/−76).
  - ROV non-uint stores are emitted as `Store(off, T(value))`.
  - The dead override is removed and the Lua operand order is fixed. C++/CUDA double-inf and float-NaN stores are covered.
  - Review: R2 APPROVE_WITH_NITS, 4 of 5 nits applied.
  - Fixer-reported tests: 10/10, 9/10 fail on master; full suite 11428/11446. dx12/Windows lanes not run. Status cmt 6620315326.

## 11-04 → 11-05: the `L`-suffix approach (#14322), merged

- **11-04 19:10Z maintainer redirect** (skiminki-nv, cmt 6639627049): "Let's actually try a different approach than the one in PR #14276".
  The new approach adds the HLSL `L` suffix to double literals. At 19:15Z I relayed it verbatim with `<github-post-authorized />` to the
  triager owner session sess-1793741880740-mvymkh (seq 20). My note: a separate draft, with #14276 left untouched.
- **~20:35Z DRAFT PR #14322** (head ee54385, "Part of #14259"), cmt 6641507357. The repro now gives `.Store(0U,42.0L)` (f64).
  Not fixed: `half`, double inf/NaN, and the C++/CUDA widths. Parked on skiminki-nv to pick #14322 or #14276.
- **21:40Z #14322 [Triage Resolution]** (head 83bc983, 5 files). Peer R1 APPROVE_WITH_NITS; N1–N5 applied, plus a dx11 FXC lane.
  The CHECK tests of #14276 and #14322 conflict. Status cmt 6642772337. Side find S3 = [#14323](14323-hlsl-sm5-double-byte-address-uint64.md)
  (FXC SM 5.x double byte-address forms); its sibling session kfytek owns dispatch, and it is filed-only.
- **11-05 09:52Z maintainer decision** (cmt 6654933375): "Let's start with #14322". skiminki-nv marked it ready at 09:37Z.
  - They are "not entirely sure" about strongly-typed HLSL literals (`int(4)`) because of compile time. They say typed literals "should also
    eliminate the need for #14276".
  - Relayed at 09:54Z (in_reply_to=80): no prototype; one delta comment with an offer to measure.
- **09:58Z** the fixer's delta (cmt 6655069001) offered to measure the compile-time cost. **Width correction:** on C++/CUDA the `float` NaN
  store wrote **8** bytes and the `double` inf store wrote 4. Earlier notes said "4 bytes" for both.
- **11:18Z** `pr_ready_for_review` for #14322 was not forwarded, because slang-pr-approver is paused. Queued in `data/approver-pause-queue.md`.
- **~15:50Z** skiminki-nv APPROVED (review 5787809163). **17:16Z #14322 MERGED** as 4a6758601. The issue stays open ("Part of");
  the fixer's note is 6664423322. #14276's HLSL CHECKs now conflict with master's `42.0L`.

## 11-06: typed half and special values (#14385)

- **15:27Z ask** (cmt 6688485351, @mention): "draft another PR for HLSL" that casts all half literals and NaN/±Inf. Examples:
  `double(0.0L / 0.0L)`, `half(1.0 / 0.0)`, `half(1.5)`. Tests: RWByteAddressBuffer tests for each case. Relayed at 15:29Z with the marker
  (in_reply_to=102). My note: build on master; "Related: #14161"; ask how to reconcile with #13927.
- **15:58Z** (cmt 6689190037): "Let us just fix the types here… it should be a fairly straightforward rebase for that PR". So #13927 rebases
  on its own. Relayed (in_reply_to=112).
- **~16:10Z DRAFT PR #14385** (head f4c657a, "Part of #14259"), cmt 6689506446. All 10 cases are fixed and checked with DXC cs_6_6
  (every one was `.f32` on master). #14161's repro compiles. Side find S4 = [#14386](14386-floattohalf-half-nan-signaling.md)
  (`FloatToHalf` signaling NaN); its sibling session exfjo9 owns dispatch, and it is filed-only.
- **16:56Z #14385 [Triage Resolution]** head 046b09c, 5 files, +180/−36. Type names come from `getDefaultBuiltinTypeName`.
  Peer R1 APPROVE_WITH_NITS; N1–N7 applied. Fixer-reported: 833/833 related tests pass.

## 11-09: strongly-typed literals (#14416)

- **09:16Z fourth ask** (cmt 6736427894): "let's try one more approach". Emit strongly-typed HLSL literals: a suffix where one is enough,
  a cast otherwise.
  - Their table: `1U`, `1L`→int, `1LL`, `1ULL`, `int16_t(1)`, `uint16_t(1)`, `1.0f`, `1.0h`, `1.0L`.
  - Tests: an SM 6.6 DXC end-to-end RWByteAddressBuffer test (MIN/MAX/0/±/±Inf/NaN), an SM 5.1 FXC test if doable, and HLSL plus DXIL output
    checks for both.
  - 09:18Z relayed (in_reply_to=138). My note: a separate draft; leave #14385 and #14276 alone; verify every row with DXC; SM 5.1 output
    is DXBC; FXC runs only on Windows CI.
- **09:20Z correction:** the comment does begin with `@nv-slang-bot:` (the webhook strips it), so I re-sent the brief with the marker as
  fixer msg 65. skiminki-nv's 09:18:24Z edit made the example `int16_t(863)`, which settles the cast spelling.
- **09:33Z amendment** (cmt 6736749599): a float test set for half, float and double: max/min finite, ± smallest denormal, ±0.0 (sign bit),
  ±Inf, NaN. The fixer's ack 6736760407 predates it and notes that DXC types `0L` as uint. Relayed at 09:36Z (in_reply_to=156): report a
  denormal flush or a lost -0.0 sign as a finding; do not adjust the test.
- **~11:15Z DRAFT PR #14416** (head 6c2d639, 54 files), cmt 6738674373. See the record's PR table for its results and open question.
  At 11:19Z I told the triager that the vk lanes are not the DXC end-to-end check. By 11:24Z the PR body and the comment said the dx12/FXC
  lanes and the DXBC CHECKs are pending on Windows CI.
