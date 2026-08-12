# slangi silently DISCARDS warnings — never use it to test for a diagnostic

## TL;DR

`slangi` (the bytecode interpreter tool) prints the diagnostic blob **only when `loadModule` fails**. A *warning* still returns a valid module, so **every warning is silently dropped**. Grepping `slangi` output for `warning|E\d{5}` is an instrument that CANNOT detect a warning — it returns "clean" identically for "no warning" and "warning suppressed".

## Evidence

`tools/slangi/main.cpp:59-65`:
```cpp
auto module = session->loadModule(moduleName.getBuffer(), diagnosticBlob.writeRef());
if (!module)
{
    maybePrintDiagnostic(diagnosticBlob);   // <-- ONLY on failure
    return SLANG_FAIL;
}
```

Measured on the same source file (`#language 2026` + `struct PC { int value; } ... (PC)0`), same Debug build:

- `slangc -no-codegen -stage compute -entry main f.slang` → `warning[E30087]: casting literal 0 to a struct type changes semantics in Slang 202c`
- `slangi f.slang` → prints only `pc=0`. **No warning. exit 0.**

Errors ARE shown by slangi (`error[E30015]: undefined identifier` printed fine) — so an error-based control gives a FALSE sense that the instrument works for diagnostics generally. Only a **warning** control exposes the blindness.

## Rule

To verify presence/absence of a **warning**, use `slangc` (optionally `-no-codegen`), not `slangi`. Upstream's own warning tests do exactly this — `tests/compute/cast-zero-to-struct.slang` uses `//TEST:SIMPLE(filecheck=WARNCHECK...): -no-codegen ...` and matches `warning[E30087]`, never an INTERPRET directive.

Corollary (the general trap): I ran a positive control and it came back NEGATIVE — `POSCONTROL=NO_WARNING`. That is what saved the result. Had I skipped the control, I would have reported "no new warning appeared" from an instrument structurally incapable of printing one. **Pair every "X is absent" claim with a control arm that makes X present on the same instrument and the same command shape.**

## Language-version gating (useful adjunct)

Warning 30087 is gated on `isSlang2026OrLater()` AND an `IntegerLiteralExpr == 0` cast to a `StructDecl`. Default module `languageVersion` is `SLANG_LANGUAGE_VERSION_DEFAULT = LEGACY (2018)`, so a test file with **no `#language` directive gets no 2026-era warnings at all**. Force a version with `slangc -std <legacy|2025|2026|202c>` (list via `slangc -h language-version`) or a `#language 2026` line — do not assume a bare test file exercises the new mode.
