---
title: "Grep the enforcement path, not the diagnostic message table — parameterized diagnostics are invisible"
type: learning
topic: misc
source: learnings/1786142356467-grep-the-enforcement-path-not-the-diagnostic-messa.md
---

# Grep the enforcement path, not the diagnostic message table — parameterized diagnostics are invisible

## The rule

To answer "does the compiler diagnose X?", grep the **code that enforces it**, not the **diagnostic definition table**. Searching the message table for the feature name gives a false "no such diagnostic" whenever the wording is parameterized.

## The evidence (shader-slang/slang, master @ 2026-08-07)

Question: does `groupshared uint counter = 0;` get diagnosed?

I grepped `source/slang/slang-diagnostics.lua` for `groupshared` → 1 unrelated hit. Concluded **"no diagnostic exists; it is silently accepted."** That was **wrong**. Reality:

```
slang-diagnostics.lua:3651   err("cannot-have-initializer", 30623,
                                 "'~decl:Decl' cannot have an initializer because it is ~reason")
slang-check-decl.cpp:3118    if (varDecl->findModifier<HLSLGroupSharedModifier>())
                                 sink->diagnose(Diagnostics::CannotHaveInitializer{
                                     .reason = "groupshared", .decl = varDecl});
slang-check-decl.cpp:3403    DiagnoseIsAllowedInitExpr(varDecl, getSink());   // unconditional
```

The string `"groupshared"` lives **only at the call site**, as the `~reason` argument. The definition is generic by design. **No grep of the message table can ever find it.**

Note Slang moved diagnostics from `slang-diagnostic-defs.h` to `source/slang/slang-diagnostics.lua` (+ `diagnostics/*.lua`). Guessing the old `.h` paths 404s — enumerate with the git tree API.

## Two independent ways this went wrong

1. **`head -10` on a 14-match grep** — the hit was below the cut. A cap on a *negative* search converts "I didn't look far enough" into "it isn't there".
2. **Parameterized wording** — structural blindness that no amount of grep completeness fixes.

## Why this failure direction is the dangerous one

"No diagnostic" reads as **"the compiler silently accepts it"** — a *reassuring* falsehood. I was one step from telling a user their uninitialized-shared-memory code compiles fine, when it in fact hard-errors. Compare the truncation cases that fabricate *alarms*: those get investigated. A fabricated all-clear gets shipped.

Confirming detail, same file: `-zero-initialize` does **not** zero groupshared either — `isDefaultInitializable` (`:3141`) early-returns via the same helper. So "no initializer + no diagnostic" would have been doubly wrong.

## Generalization

Any "is X checked/validated/rejected?" question: find the **predicate** (`findModifier<>`, `as<T>`, `hasOption`) that inspects the thing, then follow it to its `diagnose(...)`. The message table tells you *how it reads*, never *when it fires*.

Bonus (cuts against the usual delegation caution): here a **subagent refuted me**, not the reverse. Verify its citations at source — I did, all three exact — rather than discounting it because subagents have been circular before.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1786142356467-grep-the-enforcement-path-not-the-diagnostic-messa.md`_
