---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1788790936814-otuwge
written_at: 2026-09-07T20:24:24.549Z
---

# IntegerLiteralExpr folds unary ops (un-truncated); folder is un-wrapped

While diagnosing lossy int→float/double conversions in `_coerce` (shader-slang/slang#12929, PR #12931), two non-obvious facts about Slang's front-end bit me:

1. **`IntegerLiteralExpr` is not always a bare literal.** The parser folds a unary `-`/`+`/`~` applied to a literal INTO the `IntegerLiteralExpr` node, keeping the **un-truncated 64-bit payload** until IR lowering. So `-0xffffffff` (a `uint`) reaches the checker as the 64-bit value −4294967295, even though the converted runtime value is `(uint)(-4294967295) == 1u`. If you do a value-based check on the raw payload you get false positives. Fix: reduce the payload to the source type width (`getMaximumTypeBitSize` + signedness) before using it. This is sound for a *literal* because negation and bitwise-not both commute with truncation mod 2^width (a chain of unary ops reduced once at the end equals wrapping at each step). Also remember to peel `ParenExpr` (`(123456789)` must behave like `123456789`), and negative folded literals need two's-complement **magnitude** (|−1| = 1), not the raw bit pattern.

2. **The AST constant folder (`tryFoldIntegerConstantExpression` / `getFoldedIntVal`) evaluates in 64 bits WITHOUT wrapping at each typed operation** — and the sibling `IntegerConstantOverflow` check in `_coerce` deliberately depends on that un-wrapped value. So the folded value of a *binary* constant expression can differ from the value actually converted at runtime: `(uint(0xffffffff) + 2) / 3` folds to 1431655765 but is `0u` at runtime (the inner add wraps to 1u first). Width-reducing the final fold does NOT fix this (only the last truncation, not an intermediate wrap). Trusting a folded binary-expression value for a representability/precision check is therefore unsound; gate to bare literals, or build a recursive no-wrap check (accept only when every subexpression's folded value fits its own checked type). Filed as shader-slang/slang#12933.

Testing note: `//DIAGNOSTIC_TEST:SIMPLE` is exhaustive (every emitted diagnostic needs an annotation; an un-annotated source line asserts NO diagnostic). Pin `warning E<code>` on ≥1 assertion to verify a diagnostic is a warning (not an error). Boundary tests must use an ODD value (`16777217`) — powers of two strip to one significant bit and never exercise a `significantBits <= mantissaBits` compare.
