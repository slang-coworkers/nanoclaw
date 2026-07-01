---
title: "slang-lexer.cpp has a duplicate hex-digit decoder with an off-by-ten bug"
type: learning
topic: slang-compiler
source: learnings/1779805764133-slang-lexer-cpp-has-a-duplicate-hex-digit-decoder-.md
---

# slang-lexer.cpp has a duplicate hex-digit decoder with an off-by-ten bug

When triaging or fixing string-literal escape behavior in `source/compiler-core/slang-lexer.cpp`, note that there are **two** hex-digit decoders in the codebase:

1. **Shared, correct**: `CharUtil::getHexDigitValue` in `source/core/slang-char-util.h:109`. Returns `c - 'a' + 10` (and uppercase variant). Used by `CppStringEscapeHandler::appendUnescaped` in `source/core/slang-string-escape-util.cpp:425-431`, which is the path **char literals** take via `getCharLiteralValue`.

2. **Inline duplicate, buggy**: `getStringLiteralTokenValue` at `source/compiler-core/slang-lexer.cpp` (around line 1226 as of 2026-05-31, line numbers drift) does its own if/else ladder:
   ```cpp
   else if (('a' <= d) && (d <= 'f')) digitValue = d - 'a';     // BUG: missing + 10
   else if (('A' <= d) && (d <= 'F')) digitValue = d - 'A';     // BUG: missing + 10
   ```
   This is the path **string literals** take. Letter hex digits resolve to [0,5] instead of [10,15].

Effect: any string literal with hex letters silently produces wrong bytes. `"\xff"` evaluates to `5*16+5 = 0x55 = 'U'`. `"\xffffff"` also rounds down to 'U' after truncation.

Char literals are not affected by this specific off-by-ten because they use the shared util — but they have a **different** bug on the same family: `getCharLiteralValue` decodes the unescaped buffer back as UTF-8 via `getUnicodePointFromUTF8`, and a single-byte buffer of `0xff` is invalid UTF-8 (would imply 7+ continuation bytes), causing it to read past the buffer end into uninitialized memory. Same family as #11278's string OOB read fixed by PR #11281, but on the char-literal sibling.

Surfaced via issue #11291 (skiminki-nv, 2026-05-26). Off-by-ten has been on master since `64efeb9f4` (2026-04-17). No tests caught it because there are no tests for hex escapes anywhere in `tests/`.

If you ever fix anything in this area, **do not duplicate the hex decoder a third time** — replace the inline ladder with a `CharUtil::getHexDigitValue` call. The same risk applies to the octal/hex overflow checks (also missing); both decoders accept unbounded digits and silently truncate.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1779805764133-slang-lexer-cpp-has-a-duplicate-hex-digit-decoder-.md`_
