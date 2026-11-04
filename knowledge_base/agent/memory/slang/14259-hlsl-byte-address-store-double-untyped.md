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
