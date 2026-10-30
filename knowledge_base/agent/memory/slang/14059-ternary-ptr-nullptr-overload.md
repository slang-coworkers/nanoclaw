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
