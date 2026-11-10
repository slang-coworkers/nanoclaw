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

**R6 re-check (11-02 22:15Z, t-219337).** The hold expired with no blocking label, no PR and no
reporter PR. jhelferty-nv assigned jkwak-work at 18:45Z; that is the routine shepherd assignment,
not a stand-down. Triage comment posted:
https://github.com/shader-slang/slang/issues/14062#issuecomment-6589825645. Main said **go** on the
Approach A handoff (triager → slang-fixer), under the 10-31 rule "fixer chain: report it", and
reported it to the dashboard. Main also told the triager to **file the core-module constants bug**
(getPi etc.). Under the 10-31 [filing policy](../orchestrator/filing-verified-issues-policy.md) that
needs no go-ahead, which made my 10-29 dashboard question moot; it is withdrawn.

**11-02 22:37Z.** Triager handoff to slang-fixer done (fixer session `sess-1793657853787-jhxxze`,
worktree `wt-slang-14062`, `fix/issue-14062`). The triage comment was edited 22:17:55Z to say "handed
to slang-fixer" (verified). Side bug filed as **[#14211](14211-core-module-double-constants-float-rounded.md)**
(verified: nv-slang-bot, Type=Bug, `reproduced`); it is filed-only until this chain's PR merges.
As of 22:36Z the fixer's 3 new tests pass (cpu/cuda/vk bits, Metal/WGSL no double, fwd/bwd autodiff);
revert drills and the broader suite are running.

**11-03 00:57Z: draft PR [#14218](https://github.com/shader-slang/slang/pull/14218) is open** (verified):
nv-slang-bot, `fix/issue-14062` @ a692da8e5, `Fixes #14062`, `pr: non-breaking`. It changes core.meta.slang
(+8: one `FloatCast __init(double)` in the `extension<T:__BuiltinFloatingPointType>` block) and adds 3 tests:
tests/bugs/gh-14062.slang, tests/bugs/gh-14062-no-double.slang and
tests/autodiff/gh-14062-generic-init-from-double.slang. Fixer's numbers: 2383/2383 targeted tests pass. In the
full suite, 222 GPU failures came from parallel renderer contention and passed on a serial rerun. 3
tests/cooperative-matrix/fp8-cuda*.slang fail with CUDA_ERROR_INVALID_PTX with or without the change (the
generated CUDA is byte-identical). Next: slang-reviewer peer review → [Fix Report] → [Triage Resolution].
jkwak-work (the assignee) decides whether to take the draft. **#14211 trigger:** when #14218 merges.

**11-03 02:17Z [Fix Report].** Partial by scope: the `l`-suffixed cases are fixed, and unsuffixed
`T(0.1)` is left to #14057. Verified on GitHub: PR #14218 is a draft at **8762d8911**, the body says
**`Refs #14062`** (not Fixes; Main advised this at 02:14Z and the fixer agreed), and CI shows 4 pass
and 53 skipped (draft gate). slang-reviewer: APPROVE_WITH_NITS, 0 bugs; full suite 11201/11204, where
the 3 fp8-cuda failures also fail on base. The fixer applied the remedy (G1 double→half row, G2
autodiff row, N1–N4). **Next is a human step:** jkwak-work (the assignee) takes it out of draft or
closes it. Fixers can't mark it ready.
**Side find S1** (from slang-reviewer): generic `T(uintVar)` picks `IArithmetic.__init(int)`, because
`uint→int` costs 300 and `uint→float/double` costs 400. So `fromUint<double>(3000000000)` =
-1294967296.0, while concrete `double(v)` is correct. Closest is #12311 (closed). Main sent the
triager to re-verify and file it under the 10-31 policy (11-03).

**11-03 02:19Z [Triage Resolution].** Fixed within scope. The chain is **parked on jkwak-work**:
take #14218 out of draft, and decide whether to close #14062 or leave it for #14057. The
pr-mapping for #14218 points to the fixer session `jhxxze`. Main's one-shot is
`recheck-14062-pr14218-*` at 2026-11-10T02:30Z. If #14218 has merged, it dispatches #14211. If the
PR is still a draft, it reports, and the chain then rests on the /supervise-issues register. S1
filing is in progress with the triager.
- 11-03 02:40Z: S1 filed as #14222 (verified: nv-slang-bot, Type=Bug, reproduced). Filed-only; trigger added to recheck-14062-pr14218-55f1.
- 11-07: ⚠️ **Coverage gap.** The #14057 triager reports that its planned warning cannot see unsuffixed generic `T(0.1)`: `T` is unknown at check time, and no conversion exists to hook. So "left to #14057" covers no one.
  If jkwak-work closes #14062 on the assumption that #14057 has it, the case is lost.
  The triager plans to propose a separate follow-up issue when a maintainer replies on #14057. Detail: [14057 record](14057-unsuffixed-float-literal-double-warning.md).
- 11-10 02:30Z (recheck-14062-pr14218-55f1): outcome (c). #14218 is still a draft at 8762d8911, no reviews, no human comments since 11-03; #14062 has no new human comments. #14211/#14222 still have 0 comments and no linked PRs; both are self-assigned to jkwak-work (Q1 2027). Dashboard told that the chain is parked on jkwak-work and #14211/#14222 stay filed-only. Nothing more scheduled: the chain now rests on the /supervise-issues register.
