---
title: "Slang optional-constraint ICE: requirement reached through interface inheritance escapes the optional-witness guard"
type: learning
topic: slang-compiler
source: learnings/1789135806162-slang-optional-constraint-ice-requirement-reached-.md
---

# Slang optional-constraint ICE: requirement reached through interface inheritance escapes the optional-witness guard

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1789135097069-89mbif
written_at: 2026-09-11T14:10:06.162Z
---

# Slang optional-constraint ICE: requirement reached through interface inheritance escapes the optional-witness guard

Repro (HEAD 41272f842): `T compute<T>(T a,T b) where optional T : I { return a+b; }` called with a non-conforming T.

Empirical discriminator (Release slangc, GPU-free):
- `optional T : IArithmetic` (the ROOT interface that DIRECTLY declares `add`): CLEAN. `a+b` => "no overload for '+' applicable to (T,T)"; `a.add(b)` => E30403 "the constraint providing 'add' is optional and must be checked with an 'is' statement before usage".
- `optional T : IFloat | IInteger | IDifferentiableArithmetic | __BuiltinFloatingPointType` (all INHERIT IArithmetic; `add`/`operator+` is reached THROUGH the inheritance facet): ICE `SLANG_UNEXPECTED("Unexpected context type for parameter info retrieval")` in source/slang/slang-ir-typeflow-specialize.cpp (getEffectiveParamTypes:5089 / getParamInfos:5133 / getParamDirections:5177).

Root mechanism: the optional-constraint guard `isWitnessUncheckedOptional` (source/slang/slang-check-expr.cpp:1315) only recognizes a bare `DeclaredSubtypeWitness` carrying `OptionalConstraintModifier`. When the used requirement lives on a SUPER-interface, resolution composes optional(T:Sub) ∘ inheritance(Sub:Super) into a transitive/inherited witness whose head is no longer that bare optional witness, so the guard returns false, the use is allowed, and IR is emitted as `call(lookupWitness(optionalWitness, ...→Super.add))(a,b)`. On specialization with the non-conforming T the witness is None/invalid and typeflow-specialize can't classify the callee context (not IRFunc/IRSpecialize/IRSpecializeExistentialsInFunc) => the assert. It is NOT specific to `[builtin]`/`[sealed]` markers (plain IFloat/IInteger reproduce it); the builtin markers just always sit multiple inheritance hops above their arithmetic requirements. `classifyBuiltinArithmeticElementType` does not exist at this HEAD (it's from a proposed fix).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1789135806162-slang-optional-constraint-ice-requirement-reached-.md`_
