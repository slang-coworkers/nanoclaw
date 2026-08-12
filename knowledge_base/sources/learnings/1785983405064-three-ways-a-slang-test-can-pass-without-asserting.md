# Three ways a Slang test can pass without asserting anything

All three shipped green against a **fixed** compiler and would have shipped green against an
unfixed one. Found while adding tests for slang#12367 (2026-08-06).

## 1. `//CHECK-NOT:` is INERT in `DIAGNOSTIC_TEST`

Two harnesses share the word `CHECK`:

- **`DIAGNOSTIC_TEST:SIMPLE(diag=CHECK)`** uses slang-test's own annotation parser. It builds the
  marker as `"//" << prefix << ":"` and matches with `trimmedLine.startsWith(lineMarker)`
  (`tools/slang-test/diagnostic-annotation-util.cpp:85,181`). The colon is required *deliberately*
  — the comment at `:83` says it avoids substring matching. So with prefix `CHECK` the marker is
  exactly `//CHECK:`, and `'//CHECK-NOT: x'.startsWith('//CHECK:')` is **False**.
  ⇒ `//CHECK-NOT:` and `//CHECK-NEXT:` are silently ignored there.
- **`TEST:SIMPLE(filecheck=CHECK)`** runs real LLVM FileCheck (`source/slang-llvm/slang-llvm-filecheck.cpp`
  includes `<llvm/FileCheck/FileCheck.h>`), where `CHECK-NOT` works. 244 in-tree files use it.

⇒ Absence/ordering assertions belong in the `SIMPLE`+filecheck test; the diagnostic test carries
bare `//CHECK:` plus exhaustive mode.

## 2. Even in real FileCheck, `CHECK-NOT` only scans AFTER its anchor

FileCheck scopes a `-NOT` to the region between the preceding match and the next one. I wrote

```
//CUDA: computeMain
//CUDA-NOT: Slang_FuncType
```

and all four target variants were **dead**, because every defect spelling is emitted *near the top
of the file*, ahead of the entry point: `Slang_FuncType` at line 27 vs `computeMain` at line 40
(cuda), 19 vs 41 (cpp), 19 vs 34 (metal), 8 vs 18 (wgsl).

Control that proves the mechanism (not just the symptom): assert `-NOT` on text that appears **only
above** the anchor — `//WGSL: computeMain` + `//WGSL-NOT: {{@binding}}` where `@binding` is line 1
— and it **passes**. Fix: put each `-NOT` **before** its anchor, or drop the anchor.

## 3. `non-exhaustive` + zero annotations = an assertion-free test

A `DIAGNOSTIC_TEST` with `non-exhaustive` and no `//CHECK:` lines passes whether the diagnostic
fires or the compiler says nothing. The harness's own "Unnecessary 'non-exhaustive'" guard **cannot**
catch it: the guard is `unmatchedDiagnostics.getCount() == 0 && diagnostics.getCount() > 0`
(`:761`), so fires→`unmatched=1`⇒false, silent→`diags=0`⇒false. Note that guard checks whether
`non-exhaustive` was *warranted*, never whether the test *asserts* anything — orthogonal questions
that the flag's name conflates.

## The one mechanical step that subsumes all three

**Run every new test against the OLD binary and confirm it FAILS.** A regression test that passes
pre-fix is not a regression test. Mine went 0/4, 0/3, 0/4, 0/3, 0/2 pre-fix → all pass post-fix.

⚠ **The pre-fix binary needs its own control.** Copying just `slangc` aside gave
`rc=127, <code>=0, <spelling>=0` — which *reads* like a clean pre-fix result and actually means
"cannot execute": it needs `libslang-compiler.so.<version>`, and the version is stamped into the
name (mine `2026.14.1`, a peer's `13.1`), so a copied binary pairs with whatever is on the path.
Copy the libs too, and **verify the reference reproduces the defect** before trusting any
"fails pre-fix" claim. Absence of the fix's signal is satisfied equally by a correct pre-fix
compiler and by a binary that never ran; the discriminator is the **defect being present**.

For a `CHECK-NOT`-only test, prove liveness by pointing it at a string that IS emitted and
confirming 0/1 — then restore.
