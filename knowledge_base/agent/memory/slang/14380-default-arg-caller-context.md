---
type: chain
description: slang#14380 — default arguments lowered in the caller's IR context (wrong this, segfault, E99997); bot-filed 11-06 from the #13674 side findings, FILED-ONLY
---

# slang#14380: default argument lowered in the caller's context

**Filed** 2026-11-06T07:43Z by nv-slang-bot (slang-triager, owner session `sess-1792134043420-erzcp8`,
thread `gh-issue-shader-slang/slang-13674`). These are the side findings of the #13674 triage, filed
under [filing-verified-issues-policy](../orchestrator/filing-verified-issues-policy.md) once the
operator questions were withdrawn. I verified on GitHub: OPEN, label `reproduced`, no assignee, no
@-mentions, no "Fixes".

**The bug (the triager's findings, tested at master `6d43c8d88`).** The default expression is lowered
in a copy of the *caller's* IR context (`slang-lower-to-ir.cpp:4635`, `:4644`). That copy has no
binding for the callee's parameters, and its `thisVal` is the caller's. The results:
- **Silent wrong code:** in a method, `int f(int x = m)` called as `other.f()` reads the caller's
  `this.m`. It returns 1 instead of 2 on cpu, cuda and vk, and the HLSL is `S_f_0(other_0, this_1.m_0)`.
- a segfault at `slang-ir-peephole.cpp:853`;
- E99997 from `addSimpleArg()`;
- E99997 "decl catch-all" for `g(3)`, `g()`, and `fn(ITest s, int a = s.c)`.

**(c) not filed:** the body-only `int fn(ITest s){ return s.c; }` Invalid op is a duplicate of open #10150.
Fix PR #10854 (jvepsalainen-nv) is open and not a draft, last updated 2026-05-25. It is not one of
#12430's paths.

**Disposition: FILED-ONLY, no fixer chain (my call, 11-06).** The right fix depends on #13674's design,
which is tangent-vector's. skiminki-nv's rec #3 would disallow `this.N`/`s.c` in defaults, which turns
the miscompile into a diagnostic. Other cases could make lowering run in the callee context. Starting a
fixer now would pre-empt that choice. If the operator or a maintainer says "fix 14380", dispatch
slang-fixer on `gh-issue-shader-slang/slang-14380`. **Its issue_opened webhook needs NO dispatch.**

**2026-11-06T07:4xZ: the issue_opened webhook arrived in Main session `sess-1793950983048-glwbld`** (thread `gh-issue-shader-slang/slang-14380`). I checked live state: OPEN, no assignee, 0 comments, label `reproduced`. I dispatched nothing and posted nothing, per the disposition above.
