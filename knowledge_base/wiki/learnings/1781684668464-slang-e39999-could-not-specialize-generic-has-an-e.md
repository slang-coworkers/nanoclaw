---
title: "slang E39999 'could not specialize generic' has an extensible failure-reason mechanism (PR #11571)"
type: learning
topic: slang-compiler
source: learnings/1781684668464-slang-e39999-could-not-specialize-generic-has-an-e.md
---

# slang E39999 "could not specialize generic" has an extensible failure-reason mechanism (PR #11571)

When triaging confusing **E39999 "could not specialize generic for arguments of type …"** (`generic-argument-inference-failed`, `slang-diagnostics.lua:3818`), know that PR #11571 (merged 2026-06-15) added a structured mechanism to replace it case-by-case, and issue #11643 asks to extend it to all cases.

**The mechanism** (HEAD da319e61a):
- `GenericArgumentInferenceFailure` tagged union — `source/slang/slang-check-impl.h:201-238`. `enum class Kind { None, VariadicPackCountMismatch }` + payload union + **hand-written copy-ctor/assign that copies unconditionally** (safe only because the one payload is a trivially-copyable POD — adding a differently-shaped payload requires refactoring the ctor to `switch(kind)`).
- Recorded by `recordVariadicPackCountMismatchForSelectedCandidate` (`slang-check-constraint.cpp:3093`), guarded `if (failure->kind != None) return;` → **first reason wins**, one reason per candidate.
- Emitted by `CompleteOverloadCandidate` (`slang-check-overload.cpp:1482`): `if (kind == VariadicPackCountMismatch)` → focused diag; else fallback E39999 at `:1499`.
- Per-kind extension = 6 edit points: enum + payload + union-ctor (`slang-check-impl.h`) / record-site / `switch(kind)` emit / new `err()` in `slang-diagnostics.lua` (next free 30xxx generics code) + a `.slang` diagnostic test.

**Null-declref sites that fall back to E39999** (the "all other cases"): `inferGenericArguments` `slang-check-overload.cpp:2815` (arity), `:2859` (type-pack unify), `:3353` (explicit-arg invalid); `GenericArgumentSolver::solve()` `slang-check-constraint.cpp:1131` (work-list non-convergence), `:3193` (ordinary param unsolved — e.g. return-position-only `T`), `:2704` (interface/associated-type/pack **witness-not-found**, the biggest bucket).

**Two gotchas before naively extending:**
1. When the solver fails in the **outermost** generic context, a linear pass-by-pass validation can already emit a specific "does not conform to interface" message — so witness-not-found is likely already diagnosed on some paths. Confirm which paths actually reach E39999 first, or you'll emit duplicate/contradictory diagnostics.
2. The autodiff caller `slang-check-overload.cpp:3168` calls `inferGenericArguments` with `outFailure = nullptr` and drops the failure — new kinds won't surface there without extra wiring.

**Routing note:** #11643 is a maintainer-authored (csyonghe) enhancement with no `@nv-slang-bot` mention, referencing his own freshly-merged PR — same shape as #11600 where the orchestrator parked the fix-forward. The high-value triage deliverable is the enumeration itself; defer the fix-or-park decision to the parent.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1781684668464-slang-e39999-could-not-specialize-generic-has-an-e.md`_
