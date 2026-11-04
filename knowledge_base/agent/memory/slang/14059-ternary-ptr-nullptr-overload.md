---
type: chain
title: slang#14059 — `cond ? ptr : nullptr` rejected (no `?:` overload for (bool, Ptr<T>, NullPtr))
description: Human-filed (albertrodriguezclo) bug 2026-10-29 21:51:35Z, third cloth-sim batch (#14053–#14060). Dispatched to slang-triager under the R6 hold (no bot comment before 2026-11-02T21:51:35Z).
tags: [front-end, overload-resolution, pointers, nullptr, r6]
---

# slang#14059 — `cond ? ptr : nullptr` fails overload resolution

**Ask.** `(c) ? p + i : nullptr` (either operand order) fails with E39999: no overload for
'?:' applicable to `(bool, Ptr<float3,...>, NullPtr)`, on cuda/metal/spirv. The expected
result type is `Ptr<float3>`, because `nullptr` already converts implicitly to `T*` in
initializers and assignments. Workaround: `(float3*)nullptr`. `NullPtr` is
`core.meta.slang:1431` (`__magic_type(NullPtrType)`).

**Related, not a duplicate:** #13632 (`ptr != nullptr` aborts with E99999 in HLSL/WGSL emit,
because PtrLit has no emit). The reporter's own PR #13652 fixes #13632. This reporter often
opens their own fix PRs (#13903, #13945, #13652), so a bot PR during the hold is a risk.
See [13396](13396-self-referential-struct-pointer-circularity.md).

**Routing (10-29 ~21:58Z).** Live check: open, 0 comments, no labels, no Type, no triager
session. Each batch webhook landed in its own Main session; this one is
`sess-1793310697534-8cm7z2`. Dispatched to slang-triager on `gh-issue-shader-slang/slang-14059`
with the **R6 hold**: the fenced block holds a diagnostic, not a crash word, and there is no
`bot-ok`, so no bot comment before **2026-11-02T21:51:35Z**. The triage memo returns to Main
only. The triager sets one one-shot after the hold that first checks for a reporter PR or a
maintainer comment.

**Triage (slang-triager, 22:08Z; memo `/workspace/inbox/a2a-1793311726770-g032un/triage-14059.md`).**
bug / low / frontend generic inference / P2. Reproduced on cuda, metal and spirv in both orders;
`select(c,p,nullptr)` fails too. Not a regression (2026.13.1 is the same). Cause:
`operator?:<T>(bool,T,T)` (core.meta.slang:1109) gives T two constraints, `Ptr<…>` and
`NullPtr`. `TryJoinTypes` (slang-check-constraint.cpp:302) has no NullPtr arm and falls through
to `return nullptr` (:441), so `_coerce` (slang-check-conversion.cpp:2115) is never reached.
Main spot-checked :1109, the enum arm at :370, :441, and that the file has no `NullPtr`. Fix A
(recommended): a symmetric Ptr⊕NullPtr nominate-only arm next to the #13160 enum arm. B (a wide
mergeTypeConstraint fallback) and C (core.meta overloads) were rejected. The fix is independent
of #13632; the test must stay off HLSL/WGSL. Side finding, not folded in: `c ? optVal : none`
fails the same way (#6020/#6022 only added `select` overloads). **Parked on R6:** the triager's
one-shot **t-e8c92f (2026-11-02 22:00Z)** checks for a reporter PR or maintainer comment
first. If there is neither, it posts the 5-bullet + `reproduced` + Type=Bug and hands A to
slang-fixer. Next touch: t-e8c92f report.

**R6 re-check t-e8c92f (11-02 22:0xZ).** No reporter PR, no maintainer comment. The triager posted
5-bullet cmt 6589612444 (22:04:01Z) + `reproduced`; Type was already Bug. Handed fix A to
slang-fixer `sess-1793657061973-qcgux1` (one session on the thread, verified). **Assignee call:**
jhelferty-nv assigned jkwak-work at 18:44:02Z and set Type=Bug 9 s later (timeline-verified).
jkwak-work has ≥100 open assigned issues, so Main reads this as triage routing, not a claim of
ownership, and agrees with the triager: proceed. **The stand-down trigger is jkwak-work (or
the reporter) saying they will fix it** — a comment, a self-authored PR, or a request to the bot.
Next: the fixer opens a draft PR, which jkwak-work reviews.

**Draft PR #14219 (11-03 ~01:08Z; resolution reported 03:07Z).** `fix/issue-14059`, head 5ab02f8,
8 files +317/−21, `pr: non-breaking`. The PR mapping goes to fixer `sess-1793657061973-qcgux1`
(verified). It adds the Ptr⊕NullPtr arm in `TryJoinTypes`. A second commit, wider than the
brief, makes the C++/CUDA emit `_slang_select<T>`, because clang/nvrtc rejected
`select(c,p,nullptr)`; master fails the same way with `(int*)nullptr`. slang-reviewer R1
APPROVE_WITH_NITS; its nits and the negative test `ternary-nullptr-negative-14059.slang` are
applied. Tests (fixer-reported): 13/13 new tests pass on cpu/cuda/vk; `pointer/`+`enums/`
105/105; the full suite fails only on the pre-existing `fp8-cuda*` tests. Live CI on the draft:
5 SUCCESS, 53 SKIPPED. Issue comment 6592746132 is updated. **RESTING on jkwak-work**
(review + ready flip; the bot cannot flip it). Out of scope: Optional/`none` (#6020 area), and
HLSL/WGSL, which still stop at #13632.
