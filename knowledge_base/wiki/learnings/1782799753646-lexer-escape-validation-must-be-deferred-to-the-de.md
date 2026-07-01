---
title: "Lexer escape-validation must be deferred to the decode layer, not the scan pass (#include paths opt out)"
type: learning
topic: agent-ops
source: learnings/1782799753646-lexer-escape-validation-must-be-deferred-to-the-de.md
---

# Lexer escape-validation must be deferred to the decode layer, not the scan pass (#include paths opt out)

**Context:** slang#11829 — since PR #11714 / commit `c21ead269` ("Improve character and string literals", skiminki-nv, 2026-06-29), `slangc` rejects quote-form `#include "dir\utility\f.slangh"` with `error 10008: invalid string escape: \u must be followed by 4 hex digits`. A 1-day-old regression caught by the Nightly Remix Test.

**Root cause (general principle):** In the Slang lexer, escape-sequence *interpretation* is deferred and context-dependent — `getStringLiteralTokenValue` (slang-lexer.cpp:1611) decodes escapes for real string values, but `getFileNameTokenValue` (slang-lexer.cpp:1721) returns the **raw** quoted content and *deliberately never* processes escapes (its comment: "A file name usually doesn't process escape sequences ... important on Windows where `\` is a valid path separator"). PR #11714 added escape *validation* (`\u`/`\U` exact-digit-count → diagnostics 10007/10008) directly into the token-**scanning** pass `_lexStringLiteralBody` (slang-lexer.cpp:1493-1530). Validation thus became universal at lex time, before a token's downstream role is known — so it fires on `#include "..."` paths (lexed as ordinary `TokenType::StringLiteral`, preprocessor.cpp:3624) that the consumer never escape-interprets.

**Lesson:** Escape **validation** must live at the same layer as escape **interpretation** (the decode pass), never in the scan pass. The scan pass should only track enough to find the closing quote. Putting validation at scan time silently breaks every consumer that opts out of escape processing (file names, and any future raw-string consumer).

**Recommended fix (Approach A):** remove the `diagnose(...)` calls from `_lexStringLiteralBody`; move digit-count validation + 10007/10008 emission into `_decodeStringEscape`/`getStringLiteralTokenValue`. Bonus: collapses a two-source-of-truth divergence — the scan path requires *exactly* 4/8 hex digits for `\u`/`\U`, while the decode path's `_parseHexNumber(...,4U,...)` accepts *up to* 4.

**Repro discriminators that paid off:** `"a\utility\b"` and `"a\users\b"` → 10008; forward-slash control → no error (reaches normal include resolution, proving "expected" behavior); angle-bracket `<...>` form doesn't go through string-literal lexing so it's immune (separate error 10000 for stray `\`). Path values are never mangled — file-name decode is raw — so the only symptom is the spurious hard error.

**Build gotcha:** a stale prebuilt binary that predates the regression will NOT reproduce (gives E15300 not-found instead of 10008). Always rebuild at HEAD before claiming repro. Also: the baked `slangc -v` version string is set at *configure* time and can lag the actual binary — trust mtime + behavior, not the version string.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1782799753646-lexer-escape-validation-must-be-deferred-to-the-de.md`_
