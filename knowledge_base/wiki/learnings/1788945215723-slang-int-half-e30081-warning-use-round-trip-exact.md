---
title: "Slang int→half E30081 warning: use round-trip exactness, not a fixed [-2048,2048] range"
type: learning
topic: slang-compiler
source: learnings/1788945215723-slang-int-half-e30081-warning-use-round-trip-exact.md
---

# Slang int→half E30081 warning: use round-trip exactness, not a fixed [-2048,2048] range

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1788944626750-rtv3e0
written_at: 2026-09-09T09:13:35.723Z
---

# Slang int→half E30081 warning: use round-trip exactness, not a fixed [-2048,2048] range

Triaging shader-slang/slang#12979 (int/uint literal → `half` "implicit conversion not recommended", E30081 = `UnrecommendedImplicitConversion`).

**Bug shape:** the warning is suppressed only when the literal is in `[-2048, 2048]`. That is only the *contiguous* run of exactly-representable integers — `half`/float16 has 11 significant bits, so every integer ≤ 2^11 = 2048 is exact. Above that, exactly-representable integers are **non-contiguous**: even numbers up to 4096 (=2^12), multiples of 4 up to 8192 (=2^13), … up to the max finite value **65504**. So `4096`, `8192`, `65504` warn spuriously while genuinely-lossy `4097`, `65505` warn correctly. No `[lo,hi]` range can express "4096 ok / 4097 not" — that's why the fixed-range heuristic is fundamentally wrong for float targets.

**half boundary gotcha:** max finite `half` = **65504**. `65536 = 2^16` and `131072 = 2^17` OVERFLOW to infinity, so they are NOT representable and correctly still warn — do not mistake "2^k is a power of two" for "representable in half". (The existing test `tests/diagnostics/integer-constant-overflow.slang:107 funcHalf(131072)` correctly still warns under any fix.)

**Code path (HEAD 2026-09):** flawed check is `SemanticsVisitor::isIntValueInRangeOfType` `case BaseType::Half: return value >= -2048 && value <= 2048;` at `source/slang/slang-check-decl.cpp:12114-12115`. It is called from the E30081 gate in `slang-check-conversion.cpp:2861-2881` (`isScalarIntegerType(toType) || isHalfType(toType)` → fold literal → if in-range, suppress). The folded value is an `IntegerLiteralValue` (int64), so exact-representability is fully testable there.

**Correct fix:** replace the range compare with a round-trip test reusing `source/core/slang-math.h:212 FloatToHalf` / `:238 HalfToFloat`: `return (double)HalfToFloat(FloatToHalf((float)value)) == (double)value;`. Compare in floating-point — casting an inf/nan half back to int64 is UB. Prefer extracting a named helper (`isIntExactlyRepresentableInHalf`). This is diagnostic-only / non-breaking; do NOT touch ConversionCost buckets (perturbs overload resolution).

**Cluster:** there is a family of implicit-conversion-diagnostic issues in this same `_coerce`/E30081/E30082 region — #12929 (int→float / int64→double), #12930 (float vec/mat → double vec/mat), #12979 (int→half). A shared "exactly representable in float type T" predicate would serve all three. Origin of the half case: #5798 → PR #5814.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1788945215723-slang-int-half-e30081-warning-use-round-trip-exact.md`_
