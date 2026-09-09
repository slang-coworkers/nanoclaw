---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1786587844944-jrx6gf
written_at: 2026-08-13T02:57:38.732Z
---

# Class identity cast (C)c / C(c) regresses when ClassDecl excluded from ResolveInvoke coercion fast-path

Context: reviewing shader-slang/slang#12519 (fix for #12485, `new Counter(4)` ICE). Fix adds `&& !isDeclRefTypeOf<ClassDecl>(targetType)` to the single-arg coercion fast-path guard in `ResolveInvoke` (slang-check-overload.cpp:3435), routing single-arg class construction through normal overload resolution.

Finding (verified, blocking): the fast-path's *documented* purpose (comment at slang-check-overload.cpp:3410-3412) is identity casts — "casting an expression to the type it already has, without needing dummy constructor declarations." Excluding `class` from it regresses explicit class-to-class identity casts:
- `(C)c` (cast syntax) and `C(c)` (ctor-call syntax) where `c` is already a `C` COMPILED on unfixed binaries and emitted a correct identity no-op (emitted C++: `d.get()` → `C_get_0(C_x24init_0())`, value preserved).
- On the fixed binary they now FAIL: `E30066 class can only be initialized by 'new'` (when class has a single ctor) or `E39999 no overload ... applicable to arguments of type (C)` (when multiple ctors) — the exact diagnostic depends on the ctor set, but both are compile errors on previously-valid code.

Discriminating controls that made it airtight:
- TWO independent unfixed binaries (prebuilt Release + packaged 2026.13.1) both compile `(C)c` → not a rebuild artifact.
- Struct identity cast `(S)c` STILL works on the fixed binary → fast-path retained for struct; regression is class-specific, caused by exactly this change.
- Plain assignment `C d = c;` unaffected (doesn't go through the single-arg invoke fast-path). Generic `T(x)` with T=class ALSO unaffected (works on both) — narrower blast radius than "all class casts."

Reviewer signal: Devin (Reviewer B) caught this as a Bug at line 3440; nv-slang-bot (Reviewer A) SAW the identity-cast observation in its ir-correctness pass but DROPPED it at 25% confidence as "intended per class-must-use-new" — a miscall. Verify A/B disagreements empirically before trusting the drop; this is the PR#12141 blast-radius pattern (rerouting through overload resolution surfaces previously-swallowed behavior).

Proper fix direction: the fast-path (or the class/new matchup at TryCheckOverloadCandidateClassNewMatchUp, line 107-143) must still treat an identity coercion `(C)c` as a no-op rather than illegal construction — the exclusion should be narrowed to genuine construction, not all single-arg class invokes. If maintainer deems class identity-cast an acceptable casualty, PR needs a test locking in the new error + an intentional-behavior-change note.
