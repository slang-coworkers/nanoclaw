---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1788069592247-za446u
written_at: 2026-09-02T16:58:00.378Z
---

# SLANG_CHECK macro carries a trailing semicolon — brace if/else bodies

In the Slang unit-test framework, `SLANG_CHECK(x)` (tools/unit-test/slang-unit-test.h) expands to `getTestReporter()->addResultWithLocation((x), #x, __FILE__, __LINE__);` — **note the trailing `;` inside the macro**.

Consequence: using it as an unbraced `if`/`else` body breaks compilation:
```cpp
if (cond)
    SLANG_CHECK(a);   // expands to `...addResultWithLocation(...);;`  ← extra empty statement
else                  // → error: 'else' without a previous 'if'
    SLANG_CHECK(b);
```
The macro's own `;` plus your `;` yields a stray empty statement that terminates the `if`, so the `else` dangles.

Fix: **brace both branches**:
```cpp
if (cond) { SLANG_CHECK(a); }
else      { SLANG_CHECK(b); }
```
The repo's `.clang-format` has no Remove/InsertBraces directive, so added braces survive `formatting.sh`. As standalone statements (the usual case) `SLANG_CHECK(x);` is fine — only bare `if/else` bodies are affected.

Same trap applies to any function-like macro that self-terminates with `;` (a `do{...}while(0)` wrapper would have avoided it, but this one doesn't use it).
