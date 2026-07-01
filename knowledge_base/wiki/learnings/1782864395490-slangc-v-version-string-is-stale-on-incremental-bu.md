---
title: "slangc -v version string is stale on incremental builds — don't use it to identify a binary's commit"
type: learning
topic: slang-compiler
source: learnings/1782864395490-slangc-v-version-string-is-stale-on-incremental-bu.md
---

# slangc -v version string is stale on incremental builds — don't use it to identify a binary's commit

## What
`slangc -v` prints a git-describe string (e.g. `2026.10.2-33-g5230a81f2`) that is **baked at CMake CONFIGURE time**, not at compile time. An **incremental** rebuild (`cmake --build` after new source, without reconfiguring) recompiles the changed C++ but leaves the version string frozen at whatever commit the tree was at during the last `cmake --preset ...` configure. So the reported commit can be many commits older than the code actually compiled into the binary.

## Why it matters (concrete burn — triage of #11858, 2026-07-01)
Triaging "malformed UTF-8 treated as EOF, regression since #11714", I ran the on-disk `slangc` whose `-v` said `...g5230a81f2` — a commit **154 commits BEFORE** #11714. It reproduced the bug. I nearly concluded "bug predates #11714, reporter's regression attribution is wrong." **False.** The binary was a post-#11714 incremental build with a stale version string; it genuinely contained #11714's code. A fresh full build from HEAD confirmed the regression exactly as reported.

## How to apply
- Never trust `slangc -v` to tell you which commit a binary was built from. Check the **binary mtime** vs the merge date of the PR in question, and prefer a **clean rebuild from a known HEAD** before making any "bug is/ isn't present at commit X" claim.
- Better: use a **behavior discriminator** when one exists. Here, the old (pre-#11714) `getUnicodePointFromUTF8` returned non-zero garbage for a malformed sequence (no truncation) while the new one returns 0 (truncation) — so *any* binary that truncates provably has the post-#11714 decoder, regardless of its `-v` string.
- This is a specific instance of the standing rule "verify empirically, don't infer from stale state."

## Bonus: the #11858 / #11714 mechanism (lexer malformed-UTF-8-as-EOF)
`source/compiler-core/slang-lexer.cpp` `_advance` (~:306-309) has a long-standing conflation: after UTF-8 decode, `if (c == 0 || isInvalidStream) { m_cursor = m_end; } return c;` — a decoded codepoint of 0 is treated as EOF (cursor jumps to end, no diagnostic). `_advance`/`_peek` ignore the decoder's `outInvalid` out-param (`source/core/slang-char-encode.h:24`). PR #11714 rewrote `getUnicodePointFromUTF8` to validate and `return valid ? codePoint : 0U` — returning 0 on malformed input, which newly trips that conflation → silent source truncation. #11714 also added the diagnostic `invalidUtf8ByteSequence` (10006, slang-lexer-diagnostic-defs.h:32) but wired it ONLY into the string/char-literal path (:1341), not the general char-reading path. Principled fix: emit that existing diagnostic from `_advance`/`_peek` via `outInvalid` and recover (skip byte, continue) instead of jumping to EOF. #11714 has now produced ≥2 lexer regressions (this + #11829 escape-validation).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1782864395490-slangc-v-version-string-is-stale-on-incremental-bu.md`_
