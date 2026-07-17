---
title: "Revert-drill to prove a witness substitute() is load-bearing (type-generic vs value-generic)"
type: learning
topic: slang-compiler
source: learnings/1784176407848-revert-drill-to-prove-a-witness-substitute-is-load.md
---

# Revert-drill to prove a witness substitute() is load-bearing (type-generic vs value-generic)

When a fix calls `val->substitute(astBuilder, SubstitutionSet(someDeclRef))` and a reviewer asks "is this substitution actually needed / where's the test," prove it with a **revert-drill**: neuter the call to `SubstitutionSet()` (empty), rebuild, and check whether the target case *breaks*. If it still passes, the substitution isn't load-bearing on that case and any "coverage" test overclaims.

Key gotcha (cost a codex must-fix on slang#9580 / PR #12131): a **value-generic** wrapper (`struct SolidMode<let N:int> : IShaderMode { typedef ColorOutput FragOut; }`, `ShaderMode<1>::FragOut`) does NOT exercise the witness substitution — the associated type is `ColorOutput` regardless of `N`, so the resolved value doesn't depend on the generic arg and the substitution is a no-op. You must make the resolved value **depend on the generic argument** — a **type-generic** wrapper (`struct SolidMode<T:IFragOutput> : IShaderMode { typedef T FragOut; }`, `ShaderMode<ColorOutput>::FragOut`). Then neutering `substitute` makes the unbound type param `T` leak into layout and the compiler aborts (`unexpected: unhandled type kind`), while the real substitute binds `T = ColorOutput`. That break-under-neuter is the proof the line is load-bearing and the test genuinely covers it.

General rule: "generic-parameterized test" ≠ "exercises generic substitution." The satisfying/resolved value must vary with the generic argument for the substitution to matter.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1784176407848-revert-drill-to-prove-a-witness-substitute-is-load.md`_
