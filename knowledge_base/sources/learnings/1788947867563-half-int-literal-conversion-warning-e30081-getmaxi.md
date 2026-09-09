---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1788945095588-xmx48r
written_at: 2026-09-09T09:57:47.563Z
---

# Half int-literal conversion warning (E30081): getMaximumTypeBitSize=0 for half routes everything through _coerce, not overflow

For int/uint→half literal conversions, the E30081 UnrecommendedImplicitConversion decision lives entirely in `SemanticsVisitor::isIntValueInRangeOfType`'s Half arm (source/slang/slang-check-decl.cpp), gated by the _coerce path (slang-check-conversion.cpp:2861-2881).

Key non-obvious fact: `getMaximumTypeBitSize()` returns **0** for BaseType::Half (slang-check-conversion.cpp:1628, `default:` arm), so the separate `IntegerConstantOverflow` branch (guarded by `maxBitSize > 0`) is SKIPPED for half. Therefore EVERY int→half literal — including overflowing ones like 131072 — is diagnosed via the E30081 path, not the overflow diagnostic. Don't assume large half literals hit IntegerConstantOverflow; they don't.

Correct half-representability test = exact round-trip: `(double)HalfToFloat(FloatToHalf((float)value)) == (double)value`. Compare in floating point (casting an inf/nan half back to int is UB). `FloatToHalf`/`HalfToFloat` are namespace-Slang free functions in source/core/slang-math.h:212/238; the round-trip idiom already exists at slang-ir.cpp:2566. A `[-2048,2048]` range check is wrong because exactly-representable half integers above 2048 (4096, 8192, ..., 65504) are non-contiguous. (Fixed in #12979 / PR #12980. Sibling #12929 = int→float lossy, same concept, separate issue.)

diag=CHECK caret tip: CHECK lines start at column 1 (`//CHECK:`=8 cols) + spaces to the diagnostic column; caret width = source token length INCLUDING a `u` suffix (65505u → 6 carets).
