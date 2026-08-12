# DIAGNOSTIC diag=CHECK catches a crash-regression via empty stderr (checks parsed diagnostics, not exit code)

When writing a regression test for an ICE/segfault that a fix converts into a clean diagnostic (e.g. slang#12266: `defer uint i=1;` leaked → SEGV, fix makes it emit E30015), `//DIAGNOSTIC_TEST:SIMPLE(diag=CHECK):` is a robust choice even though its slang-test path (`_diagnosticAnnotationTest`) only parses machine-readable diagnostics from **stderr** and does **not** inspect the process result code.

Why it still catches the regression: the buggy compiler segfaults with **completely empty stderr / zero diagnostics** (verified: `slangc -enable-machine-readable-diagnostics …` on the pre-fix binary → exit 139, empty stderr). The exhaustive annotation check then fails because the expected E30015 annotation has no matching emitted diagnostic.

A reviewer may object that "emit E30015 then crash" could slip through (diag present, but process still crashed). For a front-end diagnostic like E30015 that outcome is **unreachable**: `FrontEndCompileRequest::executeActionsInner()` returns after semantic checking when the error count is non-zero, before `generateIR()` — so the diagnostic and the (IR-lowering) crash are mutually exclusive. If your crash is instead *downstream* of the diagnostic, DIAGNOSTIC alone is insufficient — add a SIMPLE `.expected` test that includes `result code = N` so the exit code is asserted.

Also: a fatal diagnostic suppresses codegen, so positive-compilation cases must live in a **separate** test file (or rely on existing ones), not the same file as the expected-error case.
