---
title: "slang#12042 half double-rounding — arithmetic benign, conversions are the hazard"
type: learning
topic: slang-compiler
source: learnings/1783677064766-slang-12042-half-double-rounding-arithmetic-benign.md
---

# slang#12042 half double-rounding — arithmetic benign, conversions are the hazard

Triage of shader-slang/slang#12042 (CPU/C++ `half` double-rounding, split from #11996). Three non-obvious facts that reshaped the verdict:

1. **The issue's "decimal → float → half" is imprecise for the FRONT-END literal path.** The lexer parses a half literal to a `double` (`FloatingPointLiteralValue` = `double`, `slang-lexer.h:181`) then rounds *directly* to half via `_truncateDouble(value,-14,+15,11,true)` (round-to-even) at `slang-lexer.cpp:1335-1354`. Intermediate is a 53-bit `double`, NOT a `float`, so a literal discrepancy vs ideal decimal→half requires a rare double-rounding-boundary decimal. The lexer's own comment (:1337-1341) already documents this. The genuine `float`-intermediate double-rounding is in the RUNTIME prelude `struct half` (`prelude/slang-cpp-scalar-intrinsics.h:670-713`): it has only `explicit half(float)`, no `half(double)`, so `double`→half goes `double`→`float`→`f32tof16`. (Note `f32tof16` at :563-613 is genuine round-to-nearest-EVEN, `bits += m&1`, not truncation.)

2. **Basic `half` arithmetic (`+ − × ÷`) via `float` is provably benign for NORMALIZED results** — don't over-scope a fix here. Figueroa's benign-double-rounding threshold for a final q-bit result is an intermediate of ≥ 2q+2 bits; for `half` (q=11) that's 24, and `float` has exactly 24 significand bits. So widen-to-float, op, round-to-half is clean for normalized values; residual exposure is only `half`'s subnormal/overflow region. The load-bearing correctness fix is CONVERSIONS + LITERALS, not arithmetic.

3. **A native-fp16 fast path already exists** at `slang-cpp-scalar-intrinsics.h:663-666`: `#ifdef FLT16_MIN → typedef _Float16 half; #elif __STDCPP_FLOAT16_T__==1 → typedef std::float16_t half;` (gated behind the `#ifndef SLANG_LLVM` feature-test at :647-661, C++23 `<stdfloat>`/clang≥15/gcc≥12). `struct half` is only the fallback, and it's shared by both the CPU-C++ target and the LLVM/interpreter JIT.

Also: IR float literals are ALWAYS stored as `double` (`IRFloatingPointValue`=`double`, `slang-ir.h:1042`), and `IRBuilder::getFloatValue` narrows half via `HalfToFloat(FloatToHalf((float)inValue))` at `slang-ir.cpp:2465` — a redundant float hop that could be a direct double→half round.

Disposition: PARKED needs-maintainer (design call: stdlib `std::float16_t` delegation vs header-only IEEE-754 emulation lib). Flagged risk for the stdlib route: **cross-build-host non-determinism** — a `half` const could round differently by build machine unless the fallback is bit-identical. Interim low-risk fixes if wanted: direct `double`→half ctor in `struct half`; direct double→half round at slang-ir.cpp:2465. No fixer dispatched (bot-authored tracking issue, design-gated).

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783677064766-slang-12042-half-double-rounding-arithmetic-benign.md`_
