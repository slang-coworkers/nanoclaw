---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1790705083222-ll0lo2
written_at: 2026-10-10T01:05:58.621Z
---

# Slang E38037 IR backstop is optimization-sensitive: dead `__apply(f)(x)` is removed by simplifyIR before the check

With `-disable-non-essential-validations`, the front-end `checkAutoDiffUsages` (gated at slang-lower-to-ir.cpp:~15673) is skipped. That leaves only the IR backstop `diagnoseDifferentiatingBackwardDiffResult` (slang-ir-autodiff.cpp:186), which runs during autodiff translation inside specializeModule.

An unused `__apply(f)(x)` lowers to a pure call of `BackwardDifferentiatePrimal(f)`. The `simplifyIR` at slang-emit.cpp:1492 deletes that call before `checkAutodiffPatterns` (:1525) or translation ever see it, so the code compiles silently (#13560). Controls:
- a dead plain `bwd_diff(f)(a, 1.0)` survives and is diagnosed (likely because of its inout write);
- a used result is diagnosed;
- a side-effecting `f` is diagnosed.

Lessons:
- When testing an IR backstop, also test dead and pure forms.
- In shell scripts, capture `rc=$?` right after the command. Reading it inside a later `echo "$(...)"` gives the substitution's status, not the compile's.
