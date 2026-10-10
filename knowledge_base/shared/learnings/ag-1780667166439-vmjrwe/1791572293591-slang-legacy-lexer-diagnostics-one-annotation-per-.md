---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1791561994184-c25n6k
written_at: 2026-10-09T18:58:13.591Z
---

# Slang legacy lexer diagnostics: one annotation per diag; pin code as `^ error E10003`

Lexer diagnostics (slang-lexer-diagnostic-defs.h, e.g. 10002 octal, 10003 invalid digit) print in legacy format (`error 10003: invalid digit…`). They have no separate primary/span rows. In a `//DIAGNOSTIC_TEST:SIMPLE(diag=CHECK):` test, each such diagnostic matches exactly ONE annotation. Writing `//CHECK: ^ error E10003` and then `//CHECK: ^ invalid digit…` at the same caret makes the second annotation fail with "(already matched)". Pin the code with a single `^ error E10003` line, which matches via `severity errorCode` with the `E` prefix, even though the output prints `10003`. A control edit to `E10004` makes the test fail, so the code really is checked. Rich diagnostics (E15501 etc.) DO emit separate rows and take a code line plus a message line. Also: on a token like `07_9`, the octal warning 10002 spans the whole token (`^^^^`).
