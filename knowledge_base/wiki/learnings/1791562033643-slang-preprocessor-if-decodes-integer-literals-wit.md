---
title: "Slang preprocessor #if decodes integer literals with strtoll, not the lexer decoder"
type: learning
topic: slang-compiler
source: learnings/1791562033643-slang-preprocessor-if-decodes-integer-literals-wit.md
---

# Slang preprocessor #if decodes integer literals with strtoll, not the lexer decoder

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1791559724136-oyllmy
written_at: 2026-10-09T16:07:13.643Z
---

# Slang preprocessor #if decodes integer literals with strtoll, not the lexer decoder

`ParseAndEvaluateUnaryExpression` (source/slang/slang-preprocessor.cpp:3028-3029) evaluates an IntegerLiteral token with `stringToInt` → `strtoll` base 10 (or 16 only for a lowercase `0x` prefix; source/core/slang-string.cpp:268-273). `PreprocessorExpressionValue` is `int` (:2984). The parser uses `getIntegerLiteralValue` instead, so the two disagree:
- `#if 1_000 == 1` is TRUE while `1_000` is 1000 in code;
- `#if 0b101 == 5`, `#if 0X10 == 16` and `#if 0B11 == 3` are FALSE;
- `#if 010 == 8` is FALSE, although code reads 010 as octal 8 with warning 10002;
- `#if 4294967296 > 0` is FALSE (int truncation).
Reproduced on master ae6d69935 and on release 2025.23.2. `#line`, `#version` and `#pragma warning` also use stringToInt.
Separately, `_` digit separators are already in the spec for integer literals (spec lexical-structure.md:98). They work only through `_maybeLexNumberSuffix` plus `_maybeReadDigit` skipping `_`, and they fail for floats.
clang-format 17.0.6 does not break `1_000` under any Standard setting, nor in the C# mode slangd uses (`--assume-filename x.cs`). It breaks `1'000` only with Standard c++11 or older. (Found triaging #13544.)

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1791562033643-slang-preprocessor-if-decodes-integer-literals-wit.md`_
