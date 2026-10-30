---
type: chain
title: slang#14062 — `T(0.1)` in a generic over __BuiltinFloatingPointType rounds through float for T=double
description: Human-filed (albertrodriguezclo) bug 2026-10-29 22:05:35Z, cloth-sim batch. Dispatched to slang-triager under the R6 hold (no bot comment before 2026-11-02T22:05:35Z).
tags: [front-end, generics, literals, floating-point, precision, r6]
---

# slang#14062 — generic `T(<literal>)` goes through `__init(float)`

**Ask.** In `T f<T : __BuiltinFloatingPointType>() { return T(0.1); }`, the constant selects
`__init(float)`, so `f<double>()` returns 0.10000000149011612 and `T(1e-300l)` returns 0.
`T(0.1)` gives no diagnostic; `T(0.1l)` gives only E30081. Seen on cuda and spirv-asm at
master 9931ba0ea. Expected: an `__init(double)` requirement that a double literal selects, or
per-specialization folding; failing that, a precision-loss diagnostic. Workarounds:
`convertBuiltinScalar<T>(0.1l)` (#13135, `-experimental-feature`); `__realCast` select.
Related (same repo): #6138, #6246, #12311, #13135, #10232.

**Routing (10-29 ~22:08Z).** Live check: open, 0 comments, no labels, no triager session
(only Main's `sess-1793311537354-vdsb73`). Dispatched to slang-triager on
`gh-issue-shader-slang/slang-14062` with the **R6 hold**: the fence is a repro, not a crash,
and there is no `bot-ok`, so no bot comment before **2026-11-02T22:05:35Z**. The reporter often
opens their own fix PRs (see [14059](14059-ternary-ptr-nullptr-overload.md)).

**Triage (10-29 22:24Z, slang-triager).** bug/medium/frontend+core-module/P2. Not a dup, not a
regression (same output 2026.12–master). Root cause: `__BuiltinFloatingPointType` offers only
`IFloat.__init(float)` (core.meta.slang:344), so `T(0.1l)` narrows with only E30081. The premise
is partly wrong: an unsuffixed literal is `float` by spec, so only the `l` cases are the bug
(sibling #14057 covers the warning for unsuffixed). Recommended fix A: a `FloatCast __init(double)`
in the `extension<T:__BuiltinFloatingPointType> T` block (core.meta.slang:1808). B (an interface
requirement) breaks `T(int64Var)` on Metal/WGSL; C (IFloat) mirrors rejected PR #12312.
GitHub: Type=Bug and `reproduced` set, no comment. Draft in the triager's
`memory/issues/comment-14062.md`; re-check one-shot `t-219337` at 2026-11-02T22:10Z posts it,
then asks Main about the A handoff to slang-fixer. Memo: inbox `a2a-1793312697478-q54b6g/triage-14062.md`.

**Separate finding: I verified it on the local master 977df1246.** On cuda, `double.getPi()` emits
`3.14159274101257324`, `double(0.1)` emits `0.10000000149011612`, and `double(0.1l)` emits
`0.10000000000000001`. The cause is the unsuffixed literal in `getPi` (core.meta.slang:1369).
The triager also lists ln10 in exp10, log10, and the diff.meta.slang:2182-2235 derivatives.
A `gh search` for `getPi` finds only the closed #3619 (unrelated). Filing a new issue was put
to the operator (dashboard) 10-29.
