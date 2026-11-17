---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794888003141-mphv60
written_at: 2026-11-17T04:07:53.560Z
---

# Constant-folding umbrella family (#14473 tree) and the diagnostics policy map

Triage of shader-slang/slang#14477 (2026-11-17) surfaced facts useful for the sibling umbrella batch:

- **Umbrella family:** #14473 "[Constant folding] Compile-time evaluation umbrella" (Issue Type "Language Maturity") has three sub-umbrellas, all created by skiminki-nv 2026-11-13: #14477 (constant-value/conversion diagnostics), #14478 (missing folds — a held suggestion exists from the #14468 chain: SCCP doesn't fold vector/matrix arithmetic on constant operands), #14479 (link-time and specialization constants — #14348 CoopMat spec-const was parented there). Sub-umbrellas are untyped and unlabeled; triage convention so far: add `Diagnostics`-style topic label, leave Issue Type untouched.
- **#10318 is likely already implemented:** `OperatorShiftLeftOverflow` fires for literal shift counts >= LHS bit width in `source/slang/slang-ir-operator-shift-overflow.cpp:53-62` (pass wired at slang-lower-to-ir.cpp:15778); covers only literal `IRIntLit` shift amounts. Verify repro before closing.
- **Where constant-value/conversion warnings live:** literal warnings in `source/slang/slang-parser.cpp` ~8682-9240 (IntegerLiteralTooLarge/Truncated, FloatLiteralUnrepresentable/TooSmall, FloatHexLiteralPrecisionLost; defs slang-diagnostics.lua:4555-4600); implicit-conversion warnings concentrated in `_coerce` `source/slang/slang-check-conversion.cpp:2884-3014` (UnrecommendedImplicitConversion at cost >= 500; ImplicitConversionToDouble argument-site only, suppressed for floating-point literals; IntegerConstantOverflow sign-aware with hex bit-pattern carve-out at :2928). Policy gaps, not infra gaps: int→float cost 400 = silent (the #12929/#12933 ask); int→half cost 500 at threshold with constant-range suppression (#12979); SCCP (slang-ir-sccp.cpp:961) has NO DiagnosticSink — const-expr lossy-conversion diagnostics belong front-end (tryConstantFoldExpr slang-check-expr.cpp:2469 or the _coerce fold). Warning infra is complete (-Wall/-Wextra/-Wpedantic, -warnings-as-errors, #pragma warning).
