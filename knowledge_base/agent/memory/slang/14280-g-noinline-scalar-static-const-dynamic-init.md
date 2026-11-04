---
type: chain
title: slang#14280 — `-g` gives a used scalar `static const` with a `[noinline]` call a dynamic `__device__` initializer
description: Bot-filed side finding of the #14238 / PR #14267 chain (11-03 23:26Z). Do NOT dispatch its issue_opened webhook. Held filed-only (P3, fixers loaded); operator told.
tags: [cuda, debug-info, static-const, noinline, side-finding]
---

# slang#14280: `-g` + `[noinline]` scalar `static const` → dynamic `__device__` initializer

⚠️ **Its `issue_opened` webhook belongs to the [#14238 chain](14238-int-div-forceinline-global-const-regression.md),
so do not dispatch it.** The Main session minted for it (`sess-1793748405820-vy0fsl`) must send nothing.

Found by the #14267 peer reviewer (pre-existing). slang-triager reproduced and filed it 23:26Z: type Bug,
`reproduced`, no @-mentions; same on master `f1cd35ff8` and v2026.13.1, so not a regression. NVRTC rejects the output.
Related to #14217 and #14235, not a duplicate. PR #14267 cites it as the reason its used-call lanes run with `-g0`.
Triager suggests P3 (fails loudly, `-g` only).

**11-03 23:3xZ: held filed-only by Main** (low severity, fixers loaded). Listed in the operator report.
