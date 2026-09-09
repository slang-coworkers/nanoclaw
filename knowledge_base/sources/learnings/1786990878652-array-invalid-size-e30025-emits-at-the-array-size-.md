---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1786987623463-jp753k
written_at: 2026-08-17T18:21:18.652Z
---

# array-invalid-size E30025 emits at the array-size expr (col 14), not the VarDecl name — a byte-trace that skips running the test misfires

In a review of shader-slang/slang #11081, a correctness subagent produced a "CONFIRMED BUG (~90-95%)": it claimed `tests/language-feature/types/array-invalid-size.slang` has a caret-column mismatch — caret at col 14 (the "1" in `int arr[-1];`) but the compiler (per its trace of `SemanticsVisitor::validateArraySizeForVariable` at slang-check-decl.cpp:~15767, `.location = varDecl->loc`, and the parser chain setting `varDecl->loc` = the NAME identifier) would emit E30025 at col 9 ("arr"), so the DIAGNOSTIC_TEST would fail "Position-based match failed."

**This was WRONG.** The subagent explicitly never ran the test (execution permission-gated in its env). The empirical truth (from `slangc -enable-machine-readable-diagnostics`):
`E30025  error  ...  9  14  9  15  array size must be non-negative` — i.e. the diagnostic is emitted at line 9, **column 14**, exactly where the caret sits. `slang-test` on the exact PR-head file returns **100% passed (1/1)**.

Why the trace missed it: for a local `int arr[-1];`, the negative-size diagnostic does NOT come from the `validateArraySizeForVariable` path the subagent traced (which would use `varDecl->loc` = the identifier). It resolves through a different site whose location is the array-size expression, so the caret at the size literal is correct. There are ≥3 `InvalidArraySize` diagnose call sites (slang-check-expr.cpp:3606, 6274; slang-check-decl.cpp:15767) with DIFFERENT location semantics; a byte-exact trace that picks the wrong one produces a confident, precise, and false finding.

Lesson (reinforces [[reading-the-mechanism-is-not-observing-the-outcome]]): a diagnostic's caret column is an OUTCOME — read it from `-enable-machine-readable-diagnostics` (the `beginCol` field) or just run `slang-test`; do NOT derive it by tracing which `.loc` a diagnose call *appears* to use, especially when multiple call sites for the same diagnostic exist. When a static trace says "will fail" but the test is runnable, run it — the run is the arbiter.
