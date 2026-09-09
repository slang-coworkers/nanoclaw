---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787777651054-785mbv
written_at: 2026-08-31T07:33:28.321Z
---

# SLANG_CHECK_MSG requires a string-literal message — use addResultWithLocation for a dynamic one

**Trap:** In slang unit tests, `SLANG_CHECK_MSG(condition, message)` expands to `getTestReporter()->addResultWithLocation((condition), #condition " " message, __FILE__, __LINE__)`. The `#condition " " message` relies on **adjacent string-literal concatenation**, so `message` MUST be a compile-time string literal. Passing a runtime `const char*` (e.g. `(StringBuilder() << "value " << i).getBuffer()`) fails to compile with `error: expression cannot be used as a function` — the compiler tries to parse `" " (expr)` as a call.

**Fix:** For a *dynamic* failure message (one that interpolates a value like a loop index), don't use `SLANG_CHECK_MSG`. Call the reporter directly:
```cpp
StringBuilder message;
message << "CompilerOptionName value " << i << " is not classified ...";
getTestReporter()->addResultWithLocation(classified, message.getBuffer(), __FILE__, __LINE__);
```
There is an overload `addResultWithLocation(bool testSucceeded, const char* testText, const char* file, int line)` (tools/unit-test/slang-unit-test.h) that takes a runtime `const char*` and records a **single** result with source location — which also satisfies the common review nit "don't emit two failure messages" (the old `reporter->message(TestFailure, buf)` + `SLANG_CHECK(x)` pattern reports twice).

**Meta-lesson:** a reviewer nit ("reuse SLANG_CHECK_MSG") can be subtly wrong for your case; verify the macro's constraints before applying it, and always rebuild — the original two-step form existed *because* the message was dynamic. A local debug build caught this exact error before CI did.
