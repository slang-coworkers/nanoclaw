---
type: concept
title: "Slang preprocessor and lexer: #if integer evaluation, division traps, and unterminated token content"
group: slang-language-core
tags: [slang, preprocessor, lexer, if-directive, integer-literal, strtoll, stringToInt, digit-separator, SIGFPE, ScrubbingNeeded, line-continuation, valgrind, asan]
source_count: 6
---

# Slang preprocessor and lexer: #if integer evaluation, division traps, and unterminated token content

How the Slang preprocessor evaluates integer expressions in `#if`, why that disagrees with how
ordinary code decodes the same literal, the division-overflow crash it had, and the lexer's
token-content buffers that are not NUL-terminated after a line continuation. Escape-sequence
validation in the lexer is a separate topic, on
[[wiki/concepts/slang-compiler-frontend-and-checking.md]].

## TL;DR

- `#if` decodes an integer-literal token with `stringToInt` → `strtoll` (base 10, or base 16
  only for a lowercase `0x` prefix) into an `int` `PreprocessorExpressionValue`. Ordinary code
  decodes the same token with `getIntegerLiteralValue`, so the two disagree.
- Before PR #13546 this made `#if 1_000 == 1` true, `#if 0b101 == 5`, `#if 0X10 == 16`,
  `#if 0B11 == 3` and `#if 010 == 8` false, and `#if 4294967296 > 0` false (int truncation).
  `#line`, `#version` and `#pragma warning` also use `stringToInt`.
- In code, integer literals accept `_` anywhere after the first digit or radix prefix (`123_`, `1__0`,
  `0x_FF`, `0b_101` all compile with no diagnostic), through `_maybeLexNumberSuffix` plus `_maybeReadDigit`
  skipping `_`; floats reject it. A C++-style "only between digits" rule would therefore break existing
  integer code. The separator design (`_` vs `'`) is open on #13544, and the spec page that mentions `_` is
  marked work-in-progress, so it is not grounds for "already allowed".
  clang-format 17.0.6 never splits `1_000`; it splits `1'000` only under Standard c++11 or older.
- `#if (-2147483647 - 1) / -1` (or `% -1`) crashed slangc with SIGFPE (exit 136) because
  `EvaluateInfixOp` guarded only `right == 0`. The fix makes `/ -1` a wrapping negation through
  uint64 and `% -1` zero. Widening the evaluator to int64 alone only moves the trap to
  `INT64_MIN / -1`.
- A long-lived prebuilt binary is not a valid unfixed control: it returned rc=1 on the crash
  repro. Build the control from the pinned base SHA (revert only the touched file, rebuild),
  then restore the fix and rebuild.
- A token that contains or follows a `\`-newline gets `TokenFlag::ScrubbingNeeded` (the flag
  carries across whitespace tokens). The lexer copies its text, minus the continuation, into an
  arena buffer of exactly `textEnd - textBegin` bytes with no terminating zero.
- `_readOptionalBase` / `_maybeReadDigit` dereference `*cursor` without checking `end`, so
  `getIntegerLiteralValue` on a scrubbed token reads uninitialised arena bytes. Results look
  correct only because the stray bytes are rarely digits, `_`, `x` or `b`. The fix passes
  `content.end()` into both helpers; it affects the parser, not just `#if`.
- Output-based and FileCheck tests cannot catch the over-read reliably. Use valgrind
  (`valgrind -q slangi repro.slang`), ASan, or a log of every read at `cursor >= content.end()`.
- Changing `#if` semantics breaks the nightly-only `docs/generated/tests` pipeline bundle that
  pins the old 32-bit wraparound; run that suite before merging.

## `#if` integer evaluation: `strtoll`, not the lexer decoder

`ParseAndEvaluateUnaryExpression` (`source/slang/slang-preprocessor.cpp:3028-3029`) evaluates an
`IntegerLiteral` token with `stringToInt`, which calls `strtoll` with base 10, or base 16 only
when the prefix is a lowercase `0x` (`source/core/slang-string.cpp:268-273`), and the result is
stored in `PreprocessorExpressionValue`, an `int` (:2984). The parser decodes the same token with
`getIntegerLiteralValue`. Consider:

```slang
#if 1_000 == 1      // true: strtoll stops at '_'; in code 1_000 is 1000
#if 0b101 == 5      // false; 0X10 == 16 and 0B11 == 3 are false too
#if 010 == 8        // false; code reads 010 as octal 8 with warning 10002
#if 4294967296 > 0  // false: truncated to int
```

This reproduced on master ae6d69935 and on release 2025.23.2. `#line`, `#version` and
`#pragma warning` decode their numbers through `stringToInt` as well. Digit separators are
already specified for integer literals (spec `lexical-structure.md:98`), but they work only
through `_maybeLexNumberSuffix` plus `_maybeReadDigit` skipping `_`, and they fail for floats.
On the formatter side, clang-format 17.0.6 does not break `1_000` under any `Standard` setting,
nor in the C# mode slangd uses (`--assume-filename x.cs`); it breaks `1'000` only with Standard
c++11 or older (found triaging #13544)
[#if decodes integer literals with strtoll](../learnings/1791562033643-slang-preprocessor-if-decodes-integer-literals-wit.md).
PR #13546 widened the evaluator to int64, which is an intended behaviour change that turned the
generated `if-expression-signed-overflow-wraps.slang` test stale; the nightly-suite rule is on
[[wiki/concepts/slang-tooling-f0909b0-markdown-generated-docs.md]].

## Digit separators: loose `_` is accepted today, and the design is open (#13544)

On master f7e14a1a62 (2026-10-12), integer literals accept `_` anywhere after the first digit or radix prefix and compile with no diagnostic: `123_` = 123, `1__0` = 10, `0x_FF` = 255, `0b_101` = 5. `_maybeLexNumberSuffix` (`slang-lexer.cpp:572-573`) takes `_` into the token, and `_maybeReadDigit` (:703-704, under `// TODO: need to decide on digit separator characters`) skips it when decoding. `123'` is E10005 ("newline in literal"). So any rule that allows separators only between digits is a breaking change for integers [master already accepts loose `_` in integer literals](../learnings/1791798884194-slang-master-already-accepts-loose-in-integer-lite.md).

The design is undecided, and the spec text is not evidence that it is decided. Our triage of #13544 told the reporter that "the spec already allows `_`", citing `lexical-structure.md`, whose banner says "work in progress… in many cases, inaccurate"; the lexer's TODO says the same. Draft PR #13547 then started finishing `_` for floats. The assigned maintainer (skiminki-nv) called the spec text "aspirational", put the PR on hold, and sent the `'`-vs-`_` choice to the language owner. The integer-side bug fix in the same PR (`0b1_2` → 4) stood on its own. When a triage cites a spec page as settled, first check for a WIP/non-normative banner and for a source TODO; if either is present, present the text as a draft ("the draft spec mentions X"). A GO for drafts on a language-surface feature covers only fixes that are correct whatever the design turns out to be (here the `#if` decoding PR #13546) [a non-normative spec page is not grounds for 'already allowed'](../learnings/1791798120399-a-non-normative-spec-page-is-not-grounds-for-alrea.md).

## `#if` division overflow: `INT_MIN / -1` (#13546)

On master 08d419cbf2 (Debug), `#if (-2147483647 - 1) / -1` or `% -1` crashed both slangc and
slang-test with SIGFPE (exit 136), because `EvaluateInfixOp` in `slang-preprocessor.cpp` guarded
only `right == 0`. PR #13546 handles the divisor `-1` explicitly: `/ -1` becomes a wrapping
negation through uint64 (GCC and Clang agree on the value, with a warning), and `% -1` becomes 0.
Widening the evaluator to int64 without that case would only move the trap to `INT64_MIN / -1`.
The verification trap was the control: the long-lived `/workspace/agent/slang/build` binary
returned rc=1 on this repro instead of crashing, because it was an older or differently built
binary. Build the unfixed control from the pinned base SHA, for example by reverting only the
touched file in the fix worktree and rebuilding, then restore the fix and rebuild before running
more tests
[INT_MIN / -1 SIGFPE; prebuilt binaries are not valid controls](../learnings/1791572299591-slang-if-int-min-1-crashed-slangc-sigfpe-and-prebu.md).

## Scrubbed tokens are not NUL-terminated

A token that contains a `\`-newline continuation, or directly follows one, gets
`TokenFlag::ScrubbingNeeded`, and the flag carries across whitespace tokens. `Lexer::lexToken`
(`slang-lexer.cpp` ~2544-2574, `allocateUnaligned(textEnd - textBegin)` near :2548) then copies
the token, minus the continuation, into an arena buffer of exactly that many bytes with no
terminating zero. `getIntegerLiteralValue` → `_readOptionalBase` / `_maybeReadDigit` walk
`token.getContent().begin()` and dereference `*cursor` without checking `end`, so they read
uninitialised arena memory past the token. Logging every read at `cursor >= content.end()` on a
scrubbed token fired for all of these:

```slang
#if FOO ==\
5
#if 0 == \
    0
#if 1\
0 == 10
int y = 1 + \
  7;
```

The results only looked right because the stray bytes happened not to be digits, `_`, `x` or
`b`. `#if` was protected only while it decoded through `stringToInt(String)`, which makes a
NUL-terminated copy; the parser path never was. Under `valgrind -q slangi repro.slang` the
unbounded decoder gives 12 "Conditional jump depends on uninitialised value" reports and the
bounded one gives 0. The fix, in PR #13546, passes `content.end()` into both helpers and stops
there. A plain output repro or a FileCheck test on a continued literal will NOT show the bug,
because the over-read bytes are often zero, so the A/B has to use valgrind, ASan or
instrumentation
[scrubbed tokens have no NUL terminator; getIntegerLiteralValue reads past end](../learnings/1791591002823-slang-lexer-scrubbed-newline-tokens-have-no-nul-te.md)
[decoders must bound by end; valgrind 12 vs 0](../learnings/1791597474632-slang-token-content-is-not-nul-terminated-after-an.md).

**Source learnings (6):**
- [Slang preprocessor #if decodes integer literals with strtoll, not the lexer decoder](../learnings/1791562033643-slang-preprocessor-if-decodes-integer-literals-wit.md) — `_`, `0b`, `0X`, octal and >32-bit values disagree with code; `#line`/`#version`/`#pragma warning` share it; separators fail for floats.
- [Slang `#if` `INT_MIN / -1` crashed slangc (SIGFPE), and prebuilt base-clone binaries are not valid unfixed controls](../learnings/1791572299591-slang-if-int-min-1-crashed-slangc-sigfpe-and-prebu.md) — `EvaluateInfixOp` guarded only zero; wrapping negation via uint64; build the control from the base SHA.
- [Slang lexer: scrubbed (\-newline) tokens have no NUL terminator; getIntegerLiteralValue reads past end](../learnings/1791591002823-slang-lexer-scrubbed-newline-tokens-have-no-nul-te.md) — `ScrubbingNeeded` arena copy; four over-reading shapes; pass `end`; parser affected too.
- [Slang token content is not NUL-terminated after an escaped newline — decoders must bound by end](../learnings/1791597474632-slang-token-content-is-not-nul-terminated-after-an.md) — valgrind 12 vs 0 reports; FileCheck cannot catch it.
- [Slang master already accepts loose `_` in integer literals (123_, 1__0, 0x_FF)](../learnings/1791798884194-slang-master-already-accepts-loose-in-integer-lite.md) — `_maybeLexNumberSuffix` + `_maybeReadDigit`; a between-digits rule breaks integers; `123'` is E10005; design open on #13544
- [A non-normative spec page is not grounds for 'already allowed' in a triage](../learnings/1791798120399-a-non-normative-spec-page-is-not-grounds-for-alrea.md) — check the WIP banner and source TODO; #13547 held as premature; GO only design-independent fixes

_Catalog: [[wiki/index.md]]_
