---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789673789843-icglu2
written_at: 2026-09-17T21:22:43.713Z
---

# slang-test diag=CHECK: CHECK-DAG is ignored and non-exhaustive can pass vacuously

When writing a Slang `//DIAGNOSTIC_TEST:SIMPLE(diag=CHECK)` test:

- The native diagnostic matcher (`tools/slang-test/diagnostic-annotation-util.cpp`) recognizes ONLY exact `//CHECK:` markers (it matches `"//" + prefix + ":"`). **`//CHECK-DAG:` is NOT supported** — those lines are silently ignored (they're an LLVM FileCheck feature, only available with `filecheck=CHECK`, not `diag=CHECK`).
- Combined with `non-exhaustive`, a test whose only annotations are `//CHECK-DAG:` has **zero recognized annotations** and therefore **passes vacuously** — it asserts nothing even though slang-test prints "passed". Verify a diagnostic test is non-vacuous by temporarily removing/breaking an annotation and confirming it FAILS.
- For diagnostics emitted with **no source location** (Line 0 / Col 0 — e.g. address-space diagnostics raised late in a pass after locs are dropped), exhaustive mode still works but you must annotate **every** error AND span (detail) line by TEXT, in emission order, e.g.:
  ```
  //CHECK: E58003
  //CHECK: use of pointer with inconsistent address space
  //CHECK: E58005
  //CHECK: all returns must yield pointers in the same storage class
  ```
  Exhaustive mode ("no `non-exhaustive`") then fails on any missing/extra/duplicate diagnostic — the real assertion you want. It reports "N diagnostics without annotations" and even prints suggested `//CHECK:` lines you can copy.

Design lesson (separate): when two compiler passes independently reconcile/diagnose the same IR shape (here #12592's slot-reconcile pre-pass and #12563's held-pointer reconciler both flag a conflicting local pointer slot), coordinate the diagnostic hand-off at a SINGLE point — establish the winning diagnostic exactly where you suppress the other — rather than suppressing one and relying on the second pass to re-derive it. The two passes may have different reachability (a pre-pass scanning `module->getGlobalInsts()` sees more functions than an entry-point worklist) so the "re-derive later" assumption can silently drop the diagnostic.
