---
title: "Slang DIAGNOSTIC_TEST: //CHECK-NOT: is inert — negatives enforced by exhaustive mode only"
type: learning
topic: slang-compiler
source: learnings/1782900106845-slang-diagnostic-test-check-not-is-inert-negatives.md
---

# Slang DIAGNOSTIC_TEST: //CHECK-NOT: is inert — negatives enforced by exhaustive mode only

In Slang's `//DIAGNOSTIC_TEST:SIMPLE(diag=CHECK):` harness, `//CHECK-NOT:` is **NOT an active assertion**. Verified against the parser: `tools/slang-test/diagnostic-annotation-util.cpp` builds the line marker as `"//" + prefix + ":"` (i.e. exactly `//CHECK:`) and only treats a line as an annotation when `trimmedLine.startsWith("//CHECK:")` (~line 181). `//CHECK-NOT:` does not start with `//CHECK:` (the `-` breaks the match), so it is parsed as a plain comment and ignored.

Consequence: a "must NOT warn" negative case works **purely because the harness is exhaustive-by-default** — any emitted diagnostic without a matching `//CHECK:` annotation fails the test with "diagnostic without annotation". So a negative that produces ZERO diagnostics passes; one that (wrongly) warns fails via the unannotated-diagnostic rule, NOT via CHECK-NOT text-matching.

Practical guidance:
- To assert "no warning here", just emit no diagnostic and (optionally) leave a `//CHECK-NOT: <text>` line as **documentation** — it reads like an assertion to humans but is inert. Existing feature-test files (e.g. tests/diagnostics/aliased-out-inout-parameter.slang from PR #11151) already use `//CHECK-NOT:` this way; match that in-file convention rather than switching to plain comments.
- RED→GREEN for a false-positive fix is genuine under exhaustive mode: pre-fix the negative emits an unannotated warning → test fails; post-fix no diagnostic → passes. No FileCheck binary needed (the built-in matcher runs locally via slang-test; the .slang is read at RUNTIME so you can iterate annotations without rebuilding).
- Caret alignment: the `^` column in a `//CHECK:` line equals the SOURCE column of the target character (the `//CHECK:` prefix counts toward the column). The target loc is per-AST-node: a MemberExpr diagnostic points at the member token (e.g. the `x` in `s.x`), an IndexExpr at the `[`. Don't hand-compute — copy the harness's "Suggested annotations you can copy:" output verbatim.

Corrects an earlier muddled note that framed CHECK-NOT as "needs the filecheck= runner (CI-only)": the truth is simpler — CHECK-NOT is inert everywhere; exhaustive mode is the enforcer.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1782900106845-slang-diagnostic-test-check-not-is-inert-negatives.md`_
