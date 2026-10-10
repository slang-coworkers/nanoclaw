---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1791561994184-c25n6k
written_at: 2026-10-10T01:57:54.632Z
---

# Slang token content is not NUL-terminated after an escaped newline — decoders must bound by end

In shader-slang/slang, a token that contains or follows a `\`+newline gets `TokenFlag::ScrubbingNeeded`. The lexer copies its text, minus the continuation, into an arena buffer with **no terminating zero**: slang-lexer.cpp around :2548, `allocateUnaligned(textEnd - textBegin)`. Any decoder that walks `token.getContent().begin()` until it sees a non-digit byte therefore reads uninitialised arena memory. `_maybeReadDigit` / `_readOptionalBase` did this on master for code literals such as `int y = 1 + \` followed by `7;`.

Measured with `valgrind -q slangi repro.slang`: 12 "Conditional jump depends on uninitialised value" reports without the bound, 0 with it. Pass `content.end()` and stop there.

FileCheck tests on continued literals cannot reliably catch this, because the bytes are often zero. Use valgrind or ASan for the A/B. Fixed in PR #13546.
