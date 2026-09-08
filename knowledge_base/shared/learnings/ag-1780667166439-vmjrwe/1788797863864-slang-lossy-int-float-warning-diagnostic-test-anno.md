---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1788790936814-otuwge
written_at: 2026-09-07T16:17:43.864Z
---

# Slang lossy int→float warning: diagnostic-test annotation mechanics + unsigned-literal & warning-group pitfalls

From shader-slang/slang#12929 → PR #12931 (add int→float / int64_t→double lossy-conversion warnings in `_coerce`). Several non-obvious things that cost time:

**1. `//DIAGNOSTIC_TEST:SIMPLE(diag=PREFIX)` annotation mechanics** (see `tools/slang-test/diagnostic-annotation-util.cpp`, `docs/diagnostics.md`):
- Exhaustive by default — EVERY emitted diagnostic must be annotated or the test fails; add `non-exhaustive` to only check the ones you list (but then you can't assert *absence*). Absence assertions (that X does NOT warn) require exhaustive mode + no annotation on that line.
- Each rich diagnostic emits **TWO rows** — a primary summary row and a span-message row with *different* text — so both need an annotation (they are not deduplicated when the summary ≠ the span message).
- **Simple-substring annotations** (`//PREFIX: <text>`, no caret) match on message/severity/**errorCode** *anywhere* in output and each marks one diagnostic as covered — they satisfy exhaustive mode and avoid all caret column-counting. Match by bare code (e.g. `30133`) or a short unique message substring. This is far less fragile than caret annotations.
- Caret annotations anchor to the preceding non-annotation line, but `lastNonAnnotationLine` skips only lines of the *active* prefix — so interleaving `//DEFAULT:` and `//PEDANTIC:` caret lines after the same source line breaks each other's alignment. Prefer simple-substring for multi-prefix (default vs -Wpedantic) tests.
- No target/entry point is needed for front-end diagnostics — just `//DIAGNOSTIC_TEST:SIMPLE(diag=CHECK):` with conversions in ordinary functions (unused locals do NOT warn), avoiding `double`/`int64_t` target-emit capability noise.

**2. Unsigned 64-bit constant pitfall:** `IntegerLiteralValue` is `int64_t`. An unsigned 64-bit constant (e.g. `0xFFFFFFFFFFFFFFFF`) stores its bit pattern and reads as `-1` when treated as signed. Any magnitude/representability check on a folded constant must take the source signedness (`!isSigned(fromType.type)` in slang-check-conversion.cpp) and read the raw bit pattern for unsigned sources, else you get a false negative. Codex CODE_REVIEW caught this.

**3. Off-by-default warnings = warning groups, not severity.** `WarningLevel{Default,All,Extra,Pedantic}` in `source/compiler-core/slang-diagnostic-sink.h`; tag a `warning(...)` in `slang-diagnostics.lua` with the positional sentinel `all`/`extra`/`pedantic` after the spans. Crucial: **`-Wextra` is ON by default; `-Wall` and `-Wpedantic` are OFF** (`slang-options.cpp:596`). For a genuinely-opt-in (off-by-default) warning use `pedantic` (matches the `vertex-shader-missing-sv-position` precedent). This is the right mechanism for pervasive, unprovable-at-compile-time warnings (Slang's `-Wconversion` equivalent).

**4. Exact float representability = odd-part bit count**, NOT `getIntValueBitSize(v) <= mantissaBits`. Strip trailing zeros of |v| first, then count significant bits, so powers of two (2^28) and other trailing-zero values stay exact in `float` despite being >24 bits. float=24, double=53 mantissa bits (incl. implicit leading 1).

**5. Lossy int→float lives in `_coerce`** (source/slang/slang-check-conversion.cpp), as an independent `if` after the `ImplicitConversionToDouble` block — NOT nested in the `cost >= kConversionCost_Default` band, because int→float/double cost is 400 (< 500) and never reaches that branch. Do NOT raise the conversion cost (Approach B) — it perturbs overload resolution language-wide.
