---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1784180176857-773lfi
written_at: 2026-08-10T22:23:23.165Z
---

# [approver/challenger-miss] A fixed BLOCK can be verified by the WRONG artifact — re-derive which one carries the invariant, don't re-run the prior revision's probe

## Symptom

Deciding revision R4 of shader-slang/slang#12136 ("Load autodiff builtins on demand"), where I
had recorded a **BLOCK at R2** for a deterministic SIGSEGV: a type using `IDifferentiable` only
as a *generic constraint* fired none of the lazy-load triggers, so the autodiff supplement never
loaded and downstream machinery dereferenced its absent shape.

The obvious re-check at R4 is *"did the trigger set widen?"* Answer: **no — still exactly two
trigger sites**, byte-for-byte the same predicates as the revision I blocked
(`slang-check-decl.cpp:14996` header-modifier; `slang-check-expr.cpp:6009`
`DifferentiateExpr || PrimalSubstituteExpr`).

Read naively, that says the BLOCK stands. It does not. The crash is **structurally impossible**
at R4.

## Root cause

The R2 crash was never caused by the trigger count. It was caused by the **eager/lazy boundary**:
`Array`/`Optional`/`Tuple : IDifferentiable` had been placed in the *lazily-loaded* module, so an
ordinary constraint-only use needed a declaration that only a trigger could bring in. R4 fixes the
boundary, not the triggers: those conformances are now **eager**
(`autodiff-base.meta.slang:1196-1256`), and the lazy supplement contains **zero**
type/interface/extension declarations —

```bash
grep -cE '^\s*(extension|struct|interface)\b' diff.meta.slang   # => 0
```

— only 64 `[*DerivativeOf]`-attributed derivative registrations, which are reachable *only*
through the derivative machinery, which is itself reachable only via those two triggers. With
nothing nameable stranded in the lazy module, a constraint-only use has nothing to miss. Two
triggers are now sufficient where before they were not.

## How to catch it

- **When re-gating a revision that fixes your own BLOCK, re-derive which artifact carries the
  invariant. Do not re-run the prior revision's probe and read its result as the verdict.** The
  earlier probe was aimed at the earlier *diagnosis*; a correct fix can leave that probe's answer
  completely unchanged.
- **The tell: your probe's result is identical across the fix.** If a check returns exactly what
  it returned before a change that demonstrably fixed the bug, the check is measuring the wrong
  variable. Ask what *did* change and whether that closes the path.
- **State the failure mechanism as a path, not as a property of one artifact.** "Trigger set is
  too narrow" is unfalsifiable-by-fix; "a nameable declaration sits behind a trigger that ordinary
  use does not fire" names both ends and tells you either end can close it.
- Same family as *scope every probe to the failure direction* — and the mirror of the gate-PR
  dead-flag probe, where the artifact that looks decisive (CI green, byte-identical codegen) is
  structurally incapable of discriminating the two states at issue.

## Fix

Enumerate the *contents* of both sides of a lazy/eager split, not just the load triggers. The
question that decides it: **can anything on the lazy side be named or required before a trigger
fires?** If the lazy side holds only declarations reachable through the very machinery the
triggers gate, the trigger count is not load-bearing and does not need to grow.
