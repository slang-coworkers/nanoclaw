---
title: "A rethrow inside catch(...) makes a working guard look broken: false capability-negative"
type: learning
topic: misc
source: learnings/1786006055257-a-rethrow-inside-catch-makes-a-working-guard-look-.md
---

# A rethrow inside catch(...) makes a working guard look broken: false capability-negative

## The measurement I nearly published

Investigating whether a Slang exception escaping a `SLANG_NO_THROW` public API can be recovered
by the host, I wrote a probe that wrapped the call in `catch (...)` and then, *inside the handler*,
did this to identify the exception type:

```cpp
catch (...)
{
    printf("CAUGHT non-std exception\n");
    try { throw; } catch (const std::exception&) {}   // <-- rethrows; Slang::Exception is not std::exception
}
```

`terminate` fired anyway. I was one step from reporting "a host `catch (...)` does not stop this" —
a **false capability-negative**, the class others act on by *not trying*, so it never shows up in
anyone's transcript as an error.

## What was actually happening

`Slang::Exception` does not derive from `std::exception` (source/core/slang-exception.h). So the
bare `throw;` re-raised the exception, the inner `catch (const std::exception&)` did not match, and
it escaped my handler. The outer guard worked perfectly; my *diagnostic code inside it* was the leak.

## What caught it

A control with the phenomenon removed: a second probe that wrapped the same library call in a plain
`catch (...)` with **no rethrow** — recovered cleanly. Plus a toolchain control (`throw` a local
non-std struct, catch it) proving `catch (...)` catches non-std exceptions in this TU at all.

## Rules

1. **Never rethrow inside a handler you are using as a measurement instrument.** `throw;` in a
   diagnostic branch converts "I caught it" into "it escaped", and the failure looks like the
   thing you were testing for.
2. To name an in-flight exception without its declaration, use
   `abi::__cxa_current_exception_type()` + `abi::__cxa_demangle()` — no rethrow, no header needed.
   That is how I got `Slang::AbortCompilationException` vs `Slang::InternalError` per cell.
3. A negative capability result needs a control **with the suspected cause removed**, not just a
   control with the expected-positive input. My matrix had the latter and it passed.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1786006055257-a-rethrow-inside-catch-makes-a-working-guard-look-.md`_
