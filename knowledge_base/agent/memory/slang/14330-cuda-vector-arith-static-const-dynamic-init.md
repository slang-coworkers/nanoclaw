---
type: chain
title: slang#14330 — CUDA vector arithmetic in a module-scope `static const` gives a ptx dynamic `__device__` init
description: Bot-filed 11-05 00:22Z as side find S4 of #14267 R2 (#14238 chain); filed-only, not a regression, related to #13444. 11-06 18:26Z jkwak-work asked @nv-slang-bot to triage and self-assigned; triage-only chain on gh-issue-shader-slang/slang-14330.
tags: [cuda, ptx, static-const, constant-folding, vector]
---

# slang#14330: vector `/ + * %` on constants in a global `static const` → NVRTC "dynamic initialization"

**Bug.** `static const int2 arr[2] = { int2(10, 7) / int2(4, 2), int2(1, 1) };` → CUDA emits
`__device__ static const int2 _S1 = make_int2(...) / make_int2(...);`, NVRTC rejects it. Scalar arithmetic inside the
constructor folds and passes. Not a regression (v2026.18/.21, `6815ed82d`, master `3da6f63c0`). The `issue_opened`
belonged to the [#14238 chain](14238-int-div-forceinline-global-const-regression.md), so it was not dispatched.

**11-06 18:26:31Z: jkwak-work** (cmt 6692283941): "@nv-slang-bot can you triage? It seems like the cause is on the fact
that " int2(10, 7) / int2(4, 2)" is not constant-folded?" **Self-assigned 18:26:39Z.**
**18:28Z, Main `sess-1793838162288-9dhq33`:** dispatched slang-triager (msg 13, `in_reply_to=4`, thread
`gh-issue-shader-slang/slang-14330`, `<github-post-authorized />`). It landed on the new triager session
`sess-1793989718117-k7ww13`. Scope: **triage only**, answer the folding hypothesis with file:line evidence, post it on
the issue, and ask jkwak-work whether they want a bot draft PR. **No fixer chain until they say so; the go-ahead comes
to Main first.** jhelferty-nv's #14238 "per-thread, no compile-time-constant promise" direction was passed as
background only.

**11-06 18:48:40Z: triage posted, cmt 6692726589 (verified: bot, 6.7k chars).** Memo: [raw/triage-14330.md](raw/triage-14330.md).
bug / medium / P2. Not a regression or a dup, related to #13444. Labels unchanged. Triager-reported, master `fef74e3c6`:
- Their hypothesis is partly right. SCCP folds only scalars (slang-ir-sccp.cpp:1024-1027).
- `isLegalGlobalInstForTarget` (legalize-global-values.cpp:295-305) rejects only `IRCall`; for anything else it checks the type alone.
- CUDA vector operators are non-constexpr `__device__`.
- Int `/`/`%` count as side effects, so they get a named global rather than being folded into each use.
- Options: **A** per-thread, CUDA legality by opcode (smaller). **B** vector SCCP folding, with A as fallback (IRConstant risks, #12263). **C** an emit/prelude change, not recommended.
- Cast side find: folded into #13444, not filed.
**Parked on jkwak-work:** (1) a bot PR, or they take it; (2) fold or per-thread. One-shot re-check `t-33121f` (triager group) runs 11-12 18:00Z and only relays. The webhook carries their reply.
**On a reply:** a go-ahead for a bot PR comes to Main first; then a triager → fixer handoff on this thread.
