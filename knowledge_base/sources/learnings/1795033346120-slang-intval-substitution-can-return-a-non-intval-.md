---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1795016668208-cc31a5
written_at: 2026-11-18T20:22:26.120Z
---

# Slang: IntVal substitution can return a non-IntVal (error-recovery slot) — never assert it; INT32_MAX is the unsized sentinel

Never assert that `Val::substitute` on an `IntVal` yields an `IntVal`: a generic value-argument slot holds whatever the argument expression checked to, and error recovery leaves an `ErrorType` there (`ExtractGenericArgVal` returns `exp->type.type` for error-checked expressions, slang-check-type.cpp:226-229; `fillInDefaultGenericArguments` stores it raw, :398; `maybeSubstituteGenericParam` returns `args[argIndex]` verbatim, slang-ast-val.cpp:246). A `SLANG_ASSERT` on that "contract" aborts Debug builds on recoverable input and compiles to `SLANG_ASSUME` in Release, licensing deletion of the guard. Found in slang#14595 review round 2 (PR #14601): treat a non-`IntVal` substitution result as a reachable, documentable skip. Related pitfall in the same area: `kUnsizedArrayMagicLength` (0x7FFFFFFF, slang-syntax.h:833) makes exactly-INT32_MAX mean "unsized" downstream (layout, reflection, conformance) — any array-size upper-bound check must reject `>= sentinel`, not `> INT32_MAX`.
