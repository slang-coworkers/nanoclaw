---
title: "slang rich diagnostic renderer mishandles zero-width EOF span and byte-vs-codepoint columns"
type: learning
topic: slang-compiler
source: learnings/1782151944896-slang-rich-diagnostic-renderer-mishandles-zero-wid.md
---

# slang rich diagnostic renderer mishandles zero-width EOF span and byte-vs-codepoint columns

From triaging shader-slang/slang#11684 ("unexpectedEndOfFile duplicates the last character"). All file:line at HEAD 2b14ffd06 in `source/compiler-core/slang-rich-diagnostics-render.cpp`.

**Symptom:** compiling a file ending in an identifier with NO trailing newline (e.g. just `a`) makes the rich caret-box diagnostic render the source line as `aa` (duplicated last char) with the caret one column past; for a multibyte codepoint it underlines the trailing *bytes* of the char.

**Root cause (renderer-only — NOT lexer/parser; the EOF token's col-2 location is correct):**
1. Zero-width spans (`range.begin==range.end`, which EOF has) get `length=-1` in `makeLayoutSpan` (617) as a "re-lex me" sentinel.
2. The re-lex recovery in `buildSectionLayout` (324-326) is *skipped at end-of-line*: guard `span.col-1 < line.content.getLength()` is false when the column is one past the content (col 2, content "a" len 1). So `length` stays `-1`.
3. In the COLORED branch of `renderSourceLine` (397-413), `cursor = start + span.length` = `2 + (-1) = 1` rewinds the cursor, and the trailing `content.tail(cursor-1)` re-emits the last char → `aa`.
4. Separately: humane columns are CODEPOINT-based (`SourceFile::calcColumnIndex` → `UTF8Util::calcCodePointCount`, slang-source-loc.cpp:600) but the renderer indexes `line.content` by BYTE via `span.col-1` (326, 401, 405) → multibyte chars before/at the span corrupt the highlight. Same re-lex/byte logic is duplicated in `renderDiagnosticMachineReadable` (754-856).

**Two gotchas that cost time:**
- The duplication is **color-path-specific.** With colors off, `renderSourceLine` (391-394) just does `ss << content` and prints the line once. To reproduce the bug from a non-TTY/pipe you MUST pass `slangc ... -diagnostic-color always` (flag at slang-options.cpp:1174; modes always|never|auto, auto = writer->isConsole()). Piping without the flag hides the bug.
- An integer-literal file (`1`) renders correctly because the int token has a non-zero-width span (real positive length) — so a "works for `1`, breaks for `a`" report is the signature of a zero-width-span renderer bug, not a lexer bug.

**Repro:** `printf 'a' > a.slang; slangc a.slang -target spirv -diagnostic-color always` → source line "aa". Reproduces on Linux (platform-independent renderer bug) even though reported on Windows.

The rich renderer was added in PR #9503; this class of bug (zero-width/EOL spans + codepoint vs byte) is latent there, not a recent regression.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1782151944896-slang-rich-diagnostic-renderer-mishandles-zero-wid.md`_
