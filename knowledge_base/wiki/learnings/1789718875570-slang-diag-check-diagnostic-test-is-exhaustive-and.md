---
title: "Slang diag=CHECK DIAGNOSTIC_TEST is exhaustive and ignores CHECK-NOT"
type: learning
topic: slang-compiler
source: learnings/1789718875570-slang-diag-check-diagnostic-test-is-exhaustive-and.md
---

# Slang diag=CHECK DIAGNOSTIC_TEST is exhaustive and ignores CHECK-NOT

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789712034615-sqlv4v
written_at: 2026-09-18T08:07:55.570Z
---

# Slang diag=CHECK DIAGNOSTIC_TEST is exhaustive and ignores CHECK-NOT

# Slang `//DIAGNOSTIC_TEST:SIMPLE(diag=CHECK):` matching is exhaustive and ignores `CHECK-NOT`

Verified in `tools/slang-test/` (slang-test-main.cpp `_validateOutput`/`_diagnosticAnnotationTest`; diagnostic-annotation-util.cpp `checkAnnotations`) while fixing shader-slang/slang#13166.

**`diag=CHECK` is NOT LLVM FileCheck.** It uses a custom diagnostic-annotation matcher, so `CHECK`-family FileCheck directives do not all apply:

- **`//CHECK-NOT:` is silently ignored.** The parser looks for the exact prefix `//CHECK:`; `//CHECK-NOT:` does not match that prefix, so those lines are dropped, not honored. Do NOT rely on `CHECK-NOT` to assert "no E99997 ICE" or "no duplicate diagnostic" in a `diag=CHECK` test — it does nothing.
- **Matching is EXHAUSTIVE by default** (`exhaustive = !isNonExhaustiveDiagTest()`). Every emitted diagnostic row must be matched by some annotation AND vice-versa; any *unmatched* diagnostic fails the test with "Exhaustive check failed". This is what actually gives you the negative guarantees: an unexpected E99997 (ICE) or a second/duplicate E29000 leaves an unmatched row → automatic failure. No `CHECK-NOT` needed.
- **One diagnostic often = multiple rows.** A Slang error with a differently-worded span/note produces TWO `ParsedDiagnostic` rows (primary message + span message; the span is only deduped if its text equals the primary's). E.g. E29000 "snippet parsing failed" yields a primary row AND a span "unable to parse target intrinsic snippet: …". So annotate BOTH facets — e.g. `//CHECK: E29000` + `//CHECK: snippet` — or the span row goes unmatched and the test fails. Using only `//CHECK: E29000` is INSUFFICIENT under exhaustive mode.
- **Annotations match by substring** against message / severity / errorCode (or "severity errorCode"), each consuming one still-unmatched row.

**Practical upshot:** to regression-test "diagnosed exactly once, no crash", just list the expected diagnostic facets as `//CHECK:` lines and rely on exhaustive mode. To test a de-dup/caching fix, invoke the failing construct twice — without the fix the extra diagnostic rows are unmatched → exhaustive failure. `non-exhaustive` in the directive disables the extra-row check (and the harness will complain if you add it unnecessarily).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1789718875570-slang-diag-check-diagnostic-test-is-exhaustive-and.md`_
