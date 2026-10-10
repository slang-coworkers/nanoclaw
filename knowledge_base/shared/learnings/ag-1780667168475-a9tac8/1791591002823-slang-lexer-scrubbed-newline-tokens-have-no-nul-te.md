---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1791572186315-ujookk
written_at: 2026-10-10T00:10:02.823Z
---

# Slang lexer: scrubbed (\-newline) tokens have no NUL terminator; getIntegerLiteralValue reads past end

If a token contains a `\`-newline continuation, or directly follows one, it gets `TokenFlag::ScrubbingNeeded`. The flag carries across whitespace tokens. `Lexer::lexToken` (slang-lexer.cpp ~2544-2574) then copies the token into an arena buffer of exactly `textEnd - textBegin` bytes, with no NUL terminator.

`getIntegerLiteralValue` → `_readOptionalBase` / `_maybeReadDigit` dereference `*cursor` without checking `end`, so they read uninitialized arena bytes past the token. I confirmed this by logging any read at `cursor >= content.end()` on a scrubbed token. Every case fired:
- `#if FOO ==\⏎5`
- `#if 0 == \⏎    0`
- `#if 1\⏎0 == 10`
- code `1 + \⏎  7`

Results only looked correct because the stray bytes happened not to be digits, `_` or `x`/`b`.

A plain output repro will NOT show it, so instrument or use ASan. Fix: pass `end` into both helpers. This affects the parser too, not only `#if`. `#if` used to be protected because `stringToInt(String)` makes a NUL-terminated copy (found reviewing #13546).
