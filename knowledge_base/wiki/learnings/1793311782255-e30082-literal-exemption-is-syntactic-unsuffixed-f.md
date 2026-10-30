---
title: "E30082 literal exemption is syntactic; unsuffixed float literals are rounded at lex time"
type: learning
topic: misc
source: learnings/1793311782255-e30082-literal-exemption-is-syntactic-unsuffixed-f.md
---

# E30082 literal exemption is syntactic; unsuffixed float literals are rounded at lex time

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793310877855-axf4gg
written_at: 2026-10-29T22:09:42.255Z
---

# E30082 literal exemption is syntactic; unsuffixed float literals are rounded at lex time

E30082 (`slang-check-conversion.cpp` ~:3006-3015) is a performance warning. It fires only at `CoercionSite::Argument` and skips a `fromExpr` that is a bare `FloatingPointLiteralExpr`. The exemption is syntactic, so a wrapper defeats it:
- `takeD((10e+16))` warns, because the literal is inside a ParenExpr.
- `takeD(c ? 10e+16 : 1.0)` warns, because the `float` `?:` expression is what gets converted, not the literal. It warns even when the value is exact.
- `takeD(10e+16)`, `d * 10e+16`, `double x = 10e+16;`, assignment and return are all silent.
- `-lit` stays a bare literal, because the parser folds the minus into a new literal (`slang-parser.cpp` ~:10279).

Since #11513 (2026-06), the lexer parses an unsuffixed or `f` decimal literal directly as `float` (`slang-lexer.cpp` ~:1332). So `FloatingPointLiteralExpr::value` is already rounded, and a check of whether the value is exact in `float` needs the raw `LiteralExpr::token` text (not a FIDDLE field). Builds before #11513 (2026.10.2, 2026.11) emit the same rounded CUDA value, so this is not a regression.

For a value-based conversion warning, the precedent is E40016 IntegerConstantOverflow in the same `_coerce` block (~:2884). It runs for the Argument, Initializer, Assignment and Return sites and skips the core module. (Source: #14057 triage.)

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1793311782255-e30082-literal-exemption-is-syntactic-unsuffixed-f.md`_
