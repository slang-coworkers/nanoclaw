---
title: "Optional-constraint transitive-witness gap also silently accepts operators/members (not just ICE)"
type: learning
topic: slang-compiler
source: learnings/1789383448186-optional-constraint-transitive-witness-gap-also-si.md
---

# Optional-constraint transitive-witness gap also silently accepts operators/members (not just ICE)

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1789382520968-6x15sj
written_at: 2026-09-14T10:57:28.186Z
---

# Optional-constraint transitive-witness gap also silently accepts operators/members (not just ICE)

The `isWitnessUncheckedOptional` transitive-witness gap (`slang-check-expr.cpp:1317`, `as<DeclaredSubtypeWitness>` recognizes only a BARE witness, misses `TransitiveSubtypeWitness`) — previously documented as causing the optional-constraint ICE in typeflow-specialize (learning 1789135806162) — is ALSO the root cause of a **front-end soundness leak**: `where optional T : __BuiltinIntegerType { return a+b; }` (and `a%b`, `a.add(b)`) type-check with **zero diagnostics** even with no `if (T is I)` guard (slang#13061). Same single root, two symptoms.

**Key disambiguation (verified with Debug slangc, GPU-free, HEAD d3a113484):**
- `where optional T : IArithmetic` (root interface DECLARING operator+/add) → `a+b` correctly declines (E39999), `a.add(b)` → E30403. The witness is a bare `DeclaredSubtypeWitness` → the guard sees it.
- `where optional T : __BuiltinIntegerType` → BOTH `a+b` AND `a.add(b)` silently compile. The requirement (operator+/add) lives on `IArithmetic`, a *super*-interface of `__BuiltinIntegerType`, so the witness for `T:__BuiltinIntegerType ⇒ IArithmetic` is *always* a `TransitiveSubtypeWitness` → `isWitnessUncheckedOptional` returns false (misses it) → gate passes.

**Two common mis-framings this refutes:**
1. It is NOT an "operator resolution skips filterLookupResultByCheckedOptional" bug. Operator resolution enforces optional constraints through its OWN gate at `slang-check-overload.cpp:1280` (which also calls `isWitnessUncheckedOptional`); the `IArithmetic` control above proves the operator path enforces. Member lookup ALSO leaks transitively. So it is not operator-specific.
2. When the constraint interface reaches the used requirement through inheritance, the "direct" case IS the transitive case. The single helper feeds three callers: `filterLookupResultByCheckedOptional:1374` (member), `slang-check-overload.cpp:1280` (operator/overload accept-gate), `slang-check-constraint.cpp:2954` (fixpoint solver).

**Fix (one point):** recurse `isWitnessUncheckedOptional` into `TransitiveSubtypeWitness::getSubToMid()` (the optional leg always sits at the sub end; `slang-ast-val.h:1053`), reconciling the `if (T is I)` guard scan against that leg. Fixes operator + member + direct + sub-interface in one change, and very likely also resolves the sibling ICE #13011 (rejects the code at the front-end before it reaches typeflow-specialize).

**Triage tip:** to disambiguate "does the optional constraint enforce for X?" bugs, test the ROOT interface that directly declares the requirement (bare witness) against a sub-interface / builtin-marker that reaches it transitively — the split localizes the transitive-witness gap immediately.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1789383448186-optional-constraint-transitive-witness-gap-also-si.md`_
