---
title: "Empty-statement lint (UnintendedEmptyStatement 20101) is a parser check keyed on parent-stmt type"
type: learning
topic: misc
source: learnings/1785434273353-empty-statement-lint-unintendedemptystatement-2010.md
---

# Empty-statement lint (UnintendedEmptyStatement 20101) is a parser check keyed on parent-stmt type

Context: triaging shader-slang/slang#12296 (skiminki-nv, 202c: make stray `;` an error in for/while/catch/defer, not just `if`). Verified @ be27d0787.

- The existing "potentially unintended empty statement" diagnostic is `UnintendedEmptyStatement`, code **20101**, declared as a `warning(...)` in `source/slang/slang-diagnostics.lua:979-984`. It is emitted **entirely in the parser**, NOT the semantic checker: `Parser::ParseStatement(Stmt* parentStmt)` at `slang-parser.cpp:7076-7089`, and it fires ONLY when `as<IfStmt>(parentStmt)` is true.
- A bare `;` parses to a fieldless `EmptyStmt` sentinel (`slang-ast-stmt.h:64`); an intentionally-empty body `{}` parses to a `BlockStmt`. So `as<EmptyStmt>` cleanly distinguishes a stray semicolon from a deliberate empty block — no false positives on `{}`.
- Why for/while/do/catch/defer are silent today: only the `if` body-parse sites pass the parent (`ParseStatement(ifStatement)` at :7342/:7348/:7381/:7385). The loop/defer/catch sites call `ParseStatement()` with NO parent (for :7449, while :7465, do body :7520, catch handleBody :7504, defer :7576). Threading the parent (or post-checking the returned EmptyStmt) at those sites is the single extension hook. `ParseDoStatement` (:7516) parses the `do` body before it knows while-vs-catch — relevant to the `do;` symmetry sub-case.

Warning→error-by-language-version precedent (copy this shape): the `volatile` modifier at `slang-parser.cpp:10284-10296` emits ERROR `RemovedModifierUsage` when `languageVersion >= SLANG_LANGUAGE_VERSION_2026`, else WARNING `DeprecatedModifierUsage` when `>= 2025`. Promotion is a call-site if/else picking the error-struct vs warning-struct; there is no per-diagnostic warnings-as-errors knob. Module version is `parser->currentModule->languageVersion` (`slang-ast-decl.h:833`).

Shared blocker for ALL 202c-gated *error* changes: `SLANG_LANGUAGE_VERSION_202C` does NOT exist in-tree yet (latest is `_2026` in `include/slang.h:5701-5710`); it's introduced by OPEN PR **#12179**. Both #12296 (error form) and sibling #12264 (missing-return-as-error) inherit this dependency. A pure-*warning* extension needs no version atom and can ship independently.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785434273353-empty-statement-lint-unintendedemptystatement-2010.md`_
