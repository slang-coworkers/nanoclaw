---
title: "Slang diagnostic catalog name conventions — emit sites are PascalCase, not camelCase"
type: learning
topic: slang-compiler
source: learnings/1779977434246-slang-diagnostic-catalog-name-conventions-emit-sit.md
---

# Slang diagnostic catalog name conventions — emit sites are PascalCase, not camelCase

**Rule:** When verifying whether a Slang diagnostic in `source/slang/slang-diagnostics.lua` is dead (no emit sites), grep for `Diagnostics::PascalCase`, not the kebab name and not camelCase. The lua catalog uses kebab-case names (`multi-dimensional-array-not-supported`); these are converted to **PascalCase** for the C++ binding (`Diagnostics::MultiDimensionalArrayNotSupported`), and that is the only form actually emitted at call sites. The misc-defs.h catalog (`source/compiler-core/slang-misc-diagnostic-defs.h`) is different — it defines names *already in camelCase* (`invalidArgumentForOption`) and emits them as `MiscDiagnostics::invalidArgumentForOption`.

**Why:** `slang-diagnostics.lua` is preprocessed by the fiddle / lua tooling that capitalizes the first letter of each kebab segment when generating the C++ symbol. `slang-misc-diagnostic-defs.h` is consumed by the `DIAGNOSTIC(code, severity, name, ...)` X-macro and uses `name` verbatim. So the convention varies by catalog. A bootstrap-sweep that greps a single case (whether camel or kebab or PascalCase alone) will silently miss alive entries in the other catalog and flag them as dead.

**How to apply:** Before claiming a lua-side diagnostic is unused, run:

```
grep -rn 'Diagnostics::PascalCaseName' source/
```

For misc-defs.h diagnostics, use the camelCase form:

```
grep -rn 'MiscDiagnostics::camelCaseName' source/
```

Both must come back empty before a removal is safe.

## Behavioral check is insufficient on its own

For a "dead diagnostic" claim, "I tried a repro and it didn't fire" is **not** a substitute for a clean grep. Diagnostics are typically gated on specific syntactic shapes — e.g. `MultiDimensionalArrayNotSupported` only fires from a particular subscript-expression branch in `slang-check-expr.cpp:3466`. A naive repro (`int arr2d[3][4]`) compiling cleanly does not prove the diagnostic is dead; it only proves *that* repro does not exercise the gating branch. To declare a diagnostic dead you need:

1. Zero `Diagnostics::PascalCase` references in `source/` (excluding the def itself).
2. Optional code-path audit to confirm no emission via a helper that takes the diagnostic struct.

(1) alone is sufficient; (2) without (1) is not.

## Trace

Confirmed 2026-05-28 on shader-slang/slang issues #11319 / #11320. A triage batch flagged 14 + 1 entries as dead based on a camelCase grep over the lua catalog; every single entry has a real emit site reachable via the PascalCase symbol (`grep -rn "Diagnostics::MultiDimensionalArrayNotSupported"` → `slang-check-expr.cpp:3466`). PR #11329 carries the structural fix: `extras/check-diagnostic-codes.py` validates integer-code uniqueness across both catalogs, making the recurring "are these dead?" sweep unnecessary.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1779977434246-slang-diagnostic-catalog-name-conventions-emit-sit.md`_
