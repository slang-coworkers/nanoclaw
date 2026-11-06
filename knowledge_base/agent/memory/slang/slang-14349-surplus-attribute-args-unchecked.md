---
type: chain
title: slang#14349 — surplus attribute arguments are not diagnosed (Debug assert, Release UB)
description: Bot-filed 2026-11-05 14:57:37Z by slang-triager as a spin-off of #14135 / PR #14149. Reproduced on master 04d2726db. Owned by the #14135 triager chain, so its issue_opened needs no dispatch. Starting a fixer chain needs the operator's go-ahead.
tags: [frontend, attributes, assert, ub, bot-filed, follow-up]
---

# slang#14349 — `checkAttribute` never rejects surplus args

**Origin.** CodeRabbit flagged that `[CudaLaunchBounds(64,2,3)]` asserts on the reporter's PR #14149 (part of the #14135
chain, see [slang-14135-cuda-launch-bounds-maxnreg.md](slang-14135-cuda-launch-bounds-maxnreg.md)). The slang-triager
found the bug already exists on master, and I asked it to dedup and file it (filing policy). Filed 11-05 14:57:37Z by
nv-slang-bot. Type=Bug, label `reproduced`, unassigned, 0 comments (I verified this).

**The triager's findings (master 04d2726db, GCC 12):**
- **Debug:** `[numthreads(64,1,1,1)]` asserts at slang-check-modifier.cpp:399 (E99997, exit 254). The same happens for `[WaveSize(32,64)]` :451,
  `[maxvertexcount(3,4)]` :779, `[unroll(4,5)]` :969 and `[deprecated("old","extra")]` :1254. About 25 count asserts are reachable from user code.
- **Release:** the extra arg is dropped silently. It is formally UB, because `SLANG_ASSERT` → `SLANG_ASSUME` → `__builtin_unreachable()`.
  `[WaveSize(32,64)]` comes out as `[WaveSize(32)]`, which silently changes the meaning of the SM 6.8 range form.
- **Root cause:** `checkAttribute` (:1492-1531) fills in defaults for missing args but never checks `argCount > paramCount`.
  Fix caveat: `[DllImport]` declares 1 parameter but its check accepts 1 or 2.
- **Dedup:** the nearest match is #14277 / PR #14284, a different assert in the same file (the GLSL `local_size_*_id` path).

**Routing.** Owner: slang-triager (task session `sess-1793543883324-j7v38x`, thread `gh-issue-shader-slang/slang-14135`).
The `issue_opened` webhook for #14349 is a bot follow-up, so it gets **no dispatch**. A fixer chain is offered to the operator
(dashboard thread `gh-issue-shader-slang/slang-14135`, 11-05). Without a go-ahead the issue waits for maintainer triage.

**11-05 ~15:00Z, webhook.** The `issue_opened` reached a fresh Main session (`sess-1793890660421-j0epz1`, thread
`gh-issue-shader-slang/slang-14349`). That session found this chain through the memory grep and the sibling #14135
session's transcript, and sent nothing. If the operator says yes, dispatch slang-fixer on thread `gh-issue-shader-slang/slang-14349`.
