---
title: "Slang DIAGNOSTIC_TEST(diag=CHECK) authoring — exhaustive matcher, title+span = two annotations"
type: learning
topic: slang-compiler
source: learnings/1781787235055-slang-diagnostic-test-diag-check-authoring-exhaust.md
---

# Slang DIAGNOSTIC_TEST(diag=CHECK) authoring — exhaustive matcher, title+span = two annotations

When adding a `//DIAGNOSTIC_TEST:SIMPLE(diag=CHECK): <args>` test (to cover a new compiler diagnostic), several non-obvious mechanics bite — learned shipping slang#11658's E55213 test (`tests/cuda/optix-terminate-nested-recursion.slang`):

- **It uses Slang's BUILT-IN annotation matcher, not FileCheck** → it RUNS locally via `slang-test` even when FileCheck is absent. So you can iterate to green locally (unlike `filecheck=` SIMPLE tests, which slang-test ignores without FileCheck).
- **Exhaustive by default**: every diagnostic the compiler emits for that invocation must be annotated, or the test fails with "Exhaustive check failed: Found N diagnostic(s) without annotations." Add `non-exhaustive` to the directive — `(diag=CHECK,non-exhaustive)` — to assert only the ones you annotate.
- **A diagnostic defined as `err("name", code, "TITLE", span{ loc="location", message="MSG" })` emits TWO annotatable items at the same source location** — the TITLE and the span MESSAGE. Exhaustive mode therefore needs TWO `//CHECK:` lines, e.g.:
  ```
      foo(bar);
  //CHECK:   ^ <the title text>
  //CHECK:   ^ <the full span message text>
  ```
  Annotating only one makes the harness report the OTHER as "unannotated" (it alternates which it suggests — that alternation IS the tell that there are two items).
- **Caret column must align** to the diagnostic's column (counted from column 1 of the file; `//CHECK:` is 8 chars, then pad spaces so `^` lands under the reported column). The harness prints **"Suggested annotations you can copy:"** with the exact `//CHECK:   ^ ...` line — copy it verbatim; don't hand-compute.
- **`//CHECK:` lines start at column 1** even when the source line is indented.
- **Module-wide diagnostics force a separate test file**: if the repro needs e.g. a recursive function (rejected module-wide by E55201 unless `-disable-non-essential-validations`), putting it in the same file as passing SIMPLE tests breaks those siblings. Use a dedicated file.

Also: `-disable-non-essential-validations` disables the front-end recursion check (`checkForRecursiveFunctions`, gated on `shouldRunNonEssentialValidation()`), letting recursion reach later IR passes — useful to exercise downstream "can't handle recursion" diagnostic paths that are otherwise pre-empted by E55201.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1781787235055-slang-diagnostic-test-diag-check-authoring-exhaust.md`_
