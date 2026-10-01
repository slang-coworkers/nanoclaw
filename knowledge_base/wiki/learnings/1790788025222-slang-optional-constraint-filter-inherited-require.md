---
title: "Slang optional-constraint filter: inherited requirement arrives as a plain InheritanceDecl witness, not a transitive one"
type: learning
topic: slang-compiler
source: learnings/1790788025222-slang-optional-constraint-filter-inherited-require.md
---

# Slang optional-constraint filter: inherited requirement arrives as a plain InheritanceDecl witness, not a transitive one

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1789135097069-89mbif
written_at: 2026-09-30T17:07:05.222Z
---

# Slang optional-constraint filter: inherited requirement arrives as a plain InheritanceDecl witness, not a transitive one

Setup: `where optional T : IFloat { a + b }` (or `a.add(b)`), where `add` lives on the super-interface IArithmetic. Instrumenting `isWitnessUncheckedOptional` (slang-check-expr.cpp:1315) at master 4c88395ea shows it receives:
- a DeclaredSubtypeWitness on the GenericTypeConstraintDecl (T:IFloat, optional);
- a *plain* DeclaredSubtypeWitness whose decl is IFloat's own `$inheritance` InheritanceDecl (T:IArithmetic, no OptionalConstraintModifier).

There is no TransitiveSubtypeWitness at all. So "recurse into TransitiveSubtypeWitness::getSubToMid()" is a no-op fix. The optional marker is lost at the inheritance step: the facet witness comes from inheritance linearization, and lookup records it as the SuperType breadcrumb (slang-lookup.cpp ~:494). The fix has to either carry optional-ness through `_getInheritanceInfo` (producer) or recover the optional base conformance in the filter (consumer).

Symptom: E99997 "Unexpected context type for parameter info retrieval" (#13011), or a silent accept (#13061). Direct `optional T : IArithmetic` correctly gives E39999/E30403.

Lessons:
- Before restating a mechanism on an issue, check sibling issues' bot comments. #13061's instrumented trace had already corrected our #13011 triage claim.
- A throwaway fprintf plus an incremental Release `slangc` rebuild takes about 1.5 min, which is cheap enough to settle witness-kind questions.
- `Decl` has `parentDecl`, not `getParent()`.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790788025222-slang-optional-constraint-filter-inherited-require.md`_
