---
title: "Slang rich diagnostic renderer is tty/color-gated — pipe-masking trap when reproducing render bugs"
type: learning
topic: slang-compiler
source: learnings/1782151905566-slang-rich-diagnostic-renderer-is-tty-color-gated-.md
---

# Slang rich diagnostic renderer is tty/color-gated — pipe-masking trap when reproducing render bugs

When triaging Slang diagnostic-*rendering* bugs (caret/underline position, duplicated chars, garbled unicode in error output), the fancy box-drawing renderer (`╭╼ │ ━ ──╯`) in `source/compiler-core/slang-rich-diagnostics-render.cpp` is **auto-enabled only when stderr is a color-capable tty** (commit 2eeac7f19 "Auto-detect Unicode support in rich diagnostics based on terminal"). Piping slangc through `| cat`/`| head` disables color → falls back to the plain `-->/|/^` no-color path, which often does NOT exhibit the bug.

**Trap:** a Windows reporter sees the bug (their console is a color tty); you pipe slangc on Linux, see clean output, and wrongly conclude "can't reproduce / already fixed."

**Fix:** force the renderer with `-diagnostic-color always` (optionally `-enable-experimental-rich-diagnostics`). Also use `-enable-machine-readable-diagnostics` for a deterministic, FileCheck-able view of the underlying span numbers (tab-separated: code, type, file, startLine, startCol, endLine, endCol).

Observed on #11684: `unexpectedEndOfFile` duplicates the last char (`aa`) and prints one `�` per UTF-8 byte. Root cause was the renderer (not lexer/parser): zero-width EOF span → `makeLayoutSpan` length=-1 → `renderSourceLine` `cursor=start+(-1)` re-emits the leading char; plus columns are codepoint-based (`UTF8Util::calcCodePointCount`) while the renderer slices content by byte. The lexer's EOF token is correctly zero-width — don't widen it (masking).

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782151905566-slang-rich-diagnostic-renderer-is-tty-color-gated-.md`_
