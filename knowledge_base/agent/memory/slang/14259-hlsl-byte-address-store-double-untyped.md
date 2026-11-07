---
type: chain
title: slang#14259 — HLSL constant double RWByteAddressBuffer.Store emits untyped `.Store(` → DXC f32 store
description: Human-filed (tdavidovicNV) 2026-11-03 21:35Z. TRIAGED bug/high/P2, emit-layer root cause (cmt 6616391526). Fixer (sess-1793742971321-k0j5bx) DRAFT PR #14276 @ 860cc7501; peer review R2 APPROVE_WITH_NITS; triage RESOLVED 11-04 01:48Z. Ready-flip pending (weekly list); maintainer review next.
tags: [hlsl, byte-address-buffer, double, emit-c-like]
---

# slang#14259 — constant `double` `RWByteAddressBuffer.Store<double>` → untyped HLSL `.Store(0U,42.0)`

**Ask.** `output.Store<double>(0, double(42.0))` emits `.Store(0U,42.0)` with no template arg; DXC
infers `float` and lowers to `dx.op.rawBufferStore.f32` (writes 4 bytes). Reporter points at the
`kIROp_ByteAddressBufferStore` case in `slang-emit-c-like.cpp` (Load keeps its type, Store doesn't).
Runtime-dependent doubles, RWStructuredBuffer<double>, int64/uint64 constants are fine. Reported on
v2026.20; HEAD not retested by reporter.

**Timeline.**
- 11-03 21:35Z `issue_opened` (human, no labels). Dedupe: GitHub search + memory grep → none
  (the memory hits were session-ID substrings). Dispatched to slang-triager 21:37Z.
- 11-03 21:56Z TRIAGED bug/high/P2 (target-emit HLSL), not a regression (same in v2026.13.1); comment
  6616391526, labels Type=Bug + `reproduced`. Root cause in emit, not upstream (operand is a double FloatLit):
  generic store `.Store(` untyped (slang-emit-c-like.cpp:3133); HLSL override's uint fast path dead
  (reads void `getDataType()`, slang-emit-hlsl.cpp:1505); only `float` literals suffixed. Also hits
  `Store<half>`. Side-find: slang-ir-insts.lua:1336 operand order makes `getValue()` return alignment (0 users).
  Recommended fix A: HLSL override types from value operand, `.Store<T >(` for non-uint. Literal suffixes (B)
  overlap #14161 / PR #13927 — follow-up only. Triager handed to slang-fixer directly (its msg 7);
  fixer session sess-1793742971321-k0j5bx. Memo: /workspace/inbox/a2a-1793743013793-0wjvev/triage-14259.md.
- 11-03 ~23:25Z DRAFT PR #14276 (fix/issue-14259 @ b2fb18493, `Fixes #14259`), fixer comment 6618078546.
  Scope also covers C++/CUDA `Store<double>` of non-literal constants (1.0/0.0 wrote 4 bytes) in
  slang-emit-c-like.cpp — wider than the triage brief. Test gh-14259-byte-address-store-typed (hlsl/dxil/
  cs_5_0/cpu/vk/cuda) fails 5/6 on master. Open risk for review: FXC (SM 5.x) has no templated `Store`, so
  check non-uint vector stores there. Next: slang-reviewer peer review → maintainer; ready-flip pending (weekly list).
- 11-04 00:40Z **Side-finds #14282 and #14283** (from slang-reviewer R1 on #14276). The triager filed both (Bug + `reproduced`,
  reproduced on master f1cd35ff8, deduped; #14157 is Metal/WGSL bool only) and did NOT route them; it left the fixer decision to Main.
  - #14282: HLSL ROV `RasterizerOrderedByteAddressBuffer.Load<T>` emits `.Load<T >`, and DXC rejects it with "Explicit template arguments on
    intrinsic Load are not supported". This is a loud compile error; `asfloat(Load(0))` is a workaround.
  - #14283: CPU/CUDA `Store<bool>` writes 1 byte (the prelude copies `sizeof(bool)`), while VK/DXIL write 4. This is a silent cross-target difference.
  - #14282 recorded in [its own file](14282-hlsl-rov-bab-templated-load-dxc-reject.md): filed-only until #14276 merges (one-shot `recheck-14282-pr14276-51f9`).
  - Both already have their own sibling Main `issue_opened` sessions on the canonical threads (`sess-1793752763678-y82qfn` /
    `sess-1793752764950-1glnq5`, 00:39Z). Those sessions own the dispatch, so the #14259 session dispatches nothing. **No re-triage
    needed: they are already triaged + reproduced.** A fixer chain is a fan-out (report it). Note that slang-fixer already had 8 running sessions at 00:40Z.
- 11-04 00:16Z slang-reviewer R1 on #14276: REQUEST_CHANGES (🔴 L-B1: DXC rejects templated
  `RasterizerOrderedByteAddressBuffer.Store<T >`; tested remedy patch sent to the fixer). 00:40Z slang-triager filed
  the two side-finds as #14282 (ROV `Load<T>`) and [#14283](14283-cpu-cuda-bab-store-bool-one-byte.md) (CPU/CUDA
  `Store<bool>`), both Bug + `reproduced`, not routed to the fixer.
- Sibling disposition of the side-finds: both are FILED-ONLY, with no fixer.
  - [#14282](14282-hlsl-rov-bab-templated-load-dxc-reject.md): one-shot recheck-14282-pr14276-51f9 on 11-09 12:00Z. It dispatches a fixer once #14276 merges.
  - [#14283](14283-cpu-cuda-bab-store-bool-one-byte.md): resumes on a human or maintainer signal.
- 11-04 01:48Z **[Triage Resolution]**: fixed, draft #14276 @ 860cc7501 (8 files, +253/−76), waiting for a maintainer.
  - ROV non-uint stores are emitted as `Store(off, T(value))`, because DXC rejects template args on ROV.
  - The dead HLSL override is removed and the Lua operand order is fixed. C++/CUDA double-inf and float-NaN stores are also covered.
  - Review: R1 REQUEST_CHANGES (ROV), then R2 APPROVE_WITH_NITS. 4 of 5 nits applied; the issue-numbers-in-comments nit was declined, citing tangent-vector on #14115.
  - Tests (fixer-reported): new typed/rov tests 10/10 on cpu/vk/cuda/dxil, 9/10 fail on master. Full suite 11428/11446.
  - dx12 and Windows CI lanes have not run on the draft yet. The issue status is fixer comment 6620315326.
  - **Ready-flip pending** (weekly list, P2). Resume on a maintainer review, CI, or a human comment.
- 11-04 19:10Z **Maintainer redirect.** skiminki-nv (repo admin) @-mentioned the bot on the issue (cmt 6639627049).
  - Their ask: "Let's actually try a different approach than the one in PR #14276": add the HLSL `L` suffix to double literals, then "write the PR and see whether it fixes this issue".
  - 19:15Z: I relayed it verbatim, `<github-post-authorized />`, to the triager owner session sess-1793741880740-mvymkh, which is the fixer's parent; landing verified at its seq 20.
  - The triager relays it to fixer sess-1793742971321-k0j5bx.
  - My note to it: my reading is a separate draft PR, with #14276 left untouched until skiminki-nv decides.
    - Report the half/`h` result and the C++/CUDA scope; do not widen the scope silently.
    - Avoid colliding with #14161 and PR #13927.
  - Resume on the triager's report with the new PR number.
- 11-04 ~20:35Z **Alternative DRAFT PR #14322** (head ee54385, "Part of #14259", 4 files). It adds the `L` suffix to finite HLSL
  double literals. #14276 is untouched. Result comment: 6641507357.
  - ✅ Fixed: the reported repro now gives `.Store(0U,42.0L)`, which compiles to f64.
  - ❌ Not fixed: `half(1.5)` (no `h`, because the maintainer named only `L`), double inf/NaN (`(1.0f / 0.0f)`), and the C++/CUDA widths.
  - **Parked on skiminki-nv:** pick #14322 vs #14276 (or both), and decide whether `h` and inf/NaN are in scope.
  - Peer review is requested on #14322. Resume on the triager's [Fix Report] relay or a maintainer comment. Ready-flip pending.
  - Timer: one-shot `recheck-14259-approach-p-fd8e` (11-11 12:00Z). The supervisor-state entry is set to advisory:maintainer-decision.
- 11-04 21:40Z **#14322 [Triage Resolution]** (head 83bc983, 5 files, +112/−15). Peer R1 APPROVE_WITH_NITS, 0 bugs; N1–N5 applied plus a dx11 FXC lane.
  - Status: the repro is fixed. Not covered: `half`, double inf/NaN, and C++/CUDA.
  - Conflict: #14276's and #14322's CHECK tests conflict, so whichever lands second updates its CHECKs. Fixer status comment: 6642772337.
  - Still parked on skiminki-nv; timer `recheck-14259-approach-p-fd8e` (11-11).
  - **Side find S3 = #14323**, from slang-reviewer on #14322. The triager filed it, Bug + `reproduced`, and did not route it.
    - The bug: on HLSL `cs_5_0` (FXC), every double byte-address form is invalid. A constant becomes `Store(0U,…ULL)`, a runtime value gets a `(uint64_t)` cast, `double2` passes untyped, and `Load<double>` becomes `Load<uint64_t >`.
    - Cause: `getSameSizeUIntBaseType` maps 8 bytes to UInt64 (slang-ir-byte-address-legalize.cpp:1305-1349).
    - Evidence is HLSL-only, because FXC needs Windows.
    - Already triaged and reproduced, so it needs no re-triage. Sibling Main `issue_opened` session sess-1793828426010-kfytek (21:40Z) owns its dispatch decision, so this session dispatches nothing.
    - It touches the same byte-address emit/legalize code as #14276 and #14282.
    - Disposition (kfytek, 21:42Z): [#14323](14323-hlsl-sm5-double-byte-address-uint64.md) FILED-ONLY until a #14259 PR lands; one-shot `recheck-14323-after-1425-4d9c` (11-11 13:00Z).
- 11-05 09:52Z **Maintainer decision** (skiminki-nv, cmt 6654933375, no @mention): "Let's start with #14322". skiminki-nv marked #14322
  ready for review at 09:37:29Z, so no ready-flip is pending.
  - **Still open:** they are "not entirely sure" whether HLSL emit should use strongly-typed literals (`int(4)`), because of compile-time
    concern; they say that "should also eliminate the need for #14276".
  - #14276 stays a draft and untouched. Its C++/CUDA width fix is not covered by HLSL typing.
  - 09:54Z: I relayed this verbatim to the triager owner session (in_reply_to=80). My instructions:
    - no prototype or new PR;
    - one fresh delta comment through OUTPUT_REVIEW, with factual input and an offer to measure.
  - **Now parked on:** #14322 human review and CI (fixer-owned); skiminki-nv's typed-literal / #14276 decision.
  - Knock-on: #14282's hold on "#14276 merges" may never resolve. See the note in its chain file.
- 11-05 09:58Z The fixer posted its delta (cmt 6655069001). It ack'd #14322 going first and offered to measure the compile-time cost of typed literals (an offer only).
  - What is already typed at #14322: int literals; `float` gets `f`, `double` gets `L`.
  - What is still untyped: `half` and the inf/NaN arms.
  - **Width correction:** on C++/CUDA, the `float` NaN store that #14276 fixes wrote **8** bytes. The `double` inf store wrote 4. Earlier notes here and my 11-05 relay said "4 bytes" for both, which was wrong for NaN.
- 11-05 11:18Z `pr_ready_for_review` for #14322 (head 83bc983a, CI 56 pass / 0 fail) **not forwarded**: slang-pr-approver is paused=1. Queued in `data/approver-pause-queue.md`; operator told in one line. Later events for #14322 get only the `paused` check.
- 11-05 ~15:50Z skiminki-nv **APPROVED #14322** (review 5787809163, no comments) at head 83bc983. CI is green per the fixer.
  - Merge state is BLOCKED and reviewDecision is empty, so it needs a second required review, a code-owner review, or the merge queue. That is a maintainer action; the bot has nothing to do.
  - Resume on `[Fix] PR merged` from the triager, or on skiminki-nv's typed-literal / #14276 decision.
- 11-05 17:16Z **#14322 MERGED** by skiminki-nv as 4a6758601. Master now emits finite HLSL doubles with `L`, so the reported repro is fixed.
  #14259 stays OPEN ("Part of"). Still open: `half`, HLSL double inf/NaN, and the C++/CUDA widths. Fixer note: 6664423322.
  - #14276 is still a draft at 860cc7501, and its HLSL CHECKs now conflict with master's `42.0L`.
  - Parked on skiminki-nv's typed-literal / #14276 decision; the timer is `recheck-14259-approach-p-fd8e` (11-11), case (b).
  - The triager keeps the sentinel until #14276 resolves.
- 11-06 15:27Z **New maintainer ask**: skiminki-nv (issue assignee) @-mentioned the bot in cmt 6688485351.
  - The ask: "draft another PR for HLSL" that adds casts to all half literals and to the special values NaN/±Inf. Examples:
    - `double(0.0L / 0.0L)`
    - `half(1.0 / 0.0)`
    - `half(1.5)`
  - Tests: RWByteAddressBuffer tests for the typed NaNs, Infs, and half literals.
  - 15:29Z: I relayed it verbatim with `<github-post-authorized />` to the triager owner session (in_reply_to=102), for fixer k0j5bx. My note:
    - build on master post-#14322; leave #14276 alone;
    - write "Related: #14161" (half inf/NaN bug, jkwak-work-owned), not "Fixes";
    - flag neutrally on the issue that human PR #13927 rewrites the same HLSL float NaN arm from bits, and ask skiminki-nv how to reconcile, without holding the draft.
  - Resume on the triager's report with the PR number and per-case results.
- 11-06 15:58Z skiminki-nv answered the #13927 question (cmt 6689190037, no @mention): "Let us just fix the types here… it should be a fairly
  straightforward rebase for that PR." So the third PR keeps the typed NaN arm, and #13927 rebases on its own. I relayed this to the triager owner session (in_reply_to=112).
- 11-06 ~16:10Z **Third PR: DRAFT #14385** (head f4c657a, off master fef74e3c6, "Part of #14259"). Files: slang-emit-hlsl.cpp, the new test
  gh-14259-hlsl-typed-special-literals, and one lexer CHECK test. Result cmt 6689506446.
  - Spellings, all checked with DXC cs_6_6 through `Store<T>`, all 10 cases fixed (every one was `.f32` on master):
    - `half(1.5)` → f16;
    - `half(±1.0 / 0.0)` and `half(0.0 / 0.0)` → f16;
    - `double(±1.0L / 0.0L)` and `double(0.0L / 0.0L)` → f64;
    - `float(…f / 0.0f)` → f32.
  - #14161's repro now compiles; it is linked as Related. #13927 is to rebase on top.
  - Peer review is pending, then the [Fix Report], then skiminki-nv's review. Ready-flip pending.
  - **Side find S4 = #14386**, filed by the triager (Bug + `reproduced`), not routed.
    - The bug: `FloatToHalf` (slang-math.h:222-227) narrows every NaN to 0x7C01/0xFC01, a signaling NaN with payload 1, through the SPIR-V
      constant emit and half constant folding. On VK/L40S a half NaN reads FC01.
    - Already triaged and reproduced, so it needs no re-triage. Sibling Main `issue_opened` session sess-1793981657033-exfjo9 owns
      its dispatch, so this session dispatches nothing.
    - Disposition (exfjo9, 16:18Z): [#14386](14386-floattohalf-half-nan-signaling.md) FILED-ONLY; one-shot `recheck-14386-floattohal-2ff9` (11-13 12:00Z).
    - Related: #13857's LLVM signaling-NaN record (imported/project_13857_llvm_constant_float_quiets_signaling_nan.md).
- 11-06 16:56Z **#14385 [Triage Resolution]**: fixed for the requested scope. Head 046b09c, 5 files, +180/−36, still a draft.
  - Type names come from `getDefaultBuiltinTypeName`. Peer R1 APPROVE_WITH_NITS, 0 bugs; N1–N7 applied.
  - Tests (fixer-reported): the 10 cases are width-correct; 833/833 related tests pass.
  - Next: skiminki-nv reviews it and marks it ready (ready-flip pending, weekly list).
  - Still open in this chain: the fate of #14276 and the C++/CUDA widths.
  - Side finds: all four are filed-only by their sibling sessions, with timers:
    - #14282 → 11-09
    - #14323 → 11-11
    - #14386 → 11-13 (recheck-14386-floattohal-2ff9)
    - #14283 → none (resumes on a human signal)
