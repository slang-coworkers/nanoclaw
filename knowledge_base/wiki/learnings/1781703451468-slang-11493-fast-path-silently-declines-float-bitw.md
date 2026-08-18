---
title: "Slang #11493 fast-path silently declines float-bitwise → E39999 ambiguous (regression vector)"
type: learning
topic: slang-compiler
source: learnings/1781703451468-slang-11493-fast-path-silently-declines-float-bitw.md
---

# Slang #11493 fast-path silently declines float-bitwise → E39999 ambiguous (regression vector)

**What:** PR #11493 ("Hard-code a fast path for builtin scalar/vector/matrix operators", merge `61ad43db`) added `SemanticsExprVisitor::convertToBuiltinArithmeticOp` (`source/slang/slang-check-expr.cpp:4570`, called from `visitInvokeExpr` ~4939). Its eligibility block at **`slang-check-expr.cpp:4723-4731`** restricts the bitwise family (`& | ^ << >>`) to integer operands: `if (isBitwise) eligible = isIntegerBase;`. Any non-integer operand (float, double, vector, mixed `float|int`) sets `eligible=false` and does `return nullptr` — a **silent** decline that falls through to normal overload resolution.

**Why it bites:** in overload resolution the only `operator|` candidates are the integer ones (defined generically over `T : ILogical` at `[OverloadRank(-10)]`, `core.meta.slang:3615-3736`). `float` converts to every integer width at equal `kConversionCost_GeneralConversion`; the OverloadRank tie-break only separates *builtin* candidates, not the equal float→int conversion ranks → `CompareOverloadCandidates` finds no winner → **`E39999 ambiguous call`** (slang-check-overload.cpp ~3519-3528). Pre-#11493 this resolved deterministically via implicit float→int. Reported as #11648.

**How to apply:** (1) When a builtin operator regresses to E39999-ambiguous after #11493, the suspect is the `eligible` block at slang-check-expr.cpp:4723-4731 declining silently rather than emitting a diagnostic. (2) There is **no** "bitwise requires integer operands" diagnostic in the tree (only an unrelated preprocessor `#if` message at slang-diagnostics.lua:1006) — adding the clear-diagnostic option means defining a new diag. (3) Any fix that emits a diagnostic here MUST still `return nullptr` for non-builtin operand types, or it shadows the legitimate fallback to user-defined `operator` overloads / generic-context resolution. (4) The `eligible = isIntegerBase` line is deliberate integer-only-bitwise policy by the PR author (csyonghe), so "clear diagnostic" aligns with intent; "restore implicit float→int" is the source-compat alternative — A-vs-B is a maintainer semantics call.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1781703451468-slang-11493-fast-path-silently-declines-float-bitw.md`_
