---
title: "UNREACHABLE_RETURN in Slang enforces NOTHING — it is an #ifdef _MSC_VER shim, not SLANG_UNREACHABLE"
type: learning
topic: slang-compiler
source: learnings/1786217683426-unreachable-return-in-slang-enforces-nothing-it-is.md
---

# UNREACHABLE_RETURN in Slang enforces NOTHING — it is an #ifdef _MSC_VER shim, not SLANG_UNREACHABLE

## The trap

Two macros differ by one word; one throws, one vanishes.

```cpp
// source/core/slang-common.h:284-289   -- TODO: Shouldn't these be SLANG_ prefixed?
#ifdef _MSC_VER
#define UNREACHABLE_RETURN(x)
#else
#define UNREACHABLE_RETURN(x) return x;      // <-- gcc/clang: literally the bare return
#endif

// source/core/slang-signal.h:31
#define SLANG_UNREACHABLE(msg) ::Slang::handleSignal(::Slang::SignalType::Unreachable, msg)  // throws
```

`UNREACHABLE_RETURN` is purely a codegen shim for MSVC's "not all paths return a value" warning. It
contains no assert, no trap, no signal. On gcc/clang — i.e. every Linux CI leg — it expands to
**exactly** `return x;`.

Observed on shader-slang/slang#12434: a reviewer asked for a dead `return LegalVal()` to be made
self-enforcing. The fix replaced `return LegalVal();` with `UNREACHABLE_RETURN(LegalVal());` and the
commit message said *"self-enforce the fatal invariant."* Net behavioural change on non-MSVC: **zero**.
The false claim lived in the commit message, where it retires the question for anyone reading the log.

## The convention: the macro is the silencer, SLANG_UNEXPECTED is the enforcer

Enumerated all 18 `UNREACHABLE_RETURN` sites in `slang-ir-legalize-types.cpp`:
- **14** are immediately preceded by `SLANG_UNEXPECTED("unhandled")` / `("didn't find tuple element")`.
- **4** unpaired — three are end-of-function fallthroughs after exhaustive switches (nothing precedes
  them but `}`), one was the new code.

So the correct form when a preceding statement's control flow is load-bearing:

```cpp
SLANG_UNEXPECTED("fatal diagnostic must abort compilation");
UNREACHABLE_RETURN(LegalVal());
```

## Pick the enforcer deliberately — SLANG_ASSERT would reproduce the gap

- `SLANG_UNEXPECTED` (`slang-signal.h:27`) — unconditional `handleSignal`, **fires in Release**.
- `SLANG_ASSERT` (`slang-common.h:363-372`) — `#ifdef _DEBUG`; in Release becomes
  **`SLANG_ASSUME(VALUE)`**, an optimizer hint (UB), not a check.

A guard proven only in Debug is *absent and UB* in Release. Verify which macro you are reaching for
by reading its definition, not by name similarity.

## Generalization

Applying a remedy by **name-matching an in-tree idiom** rather than reading what the idiom does can
move the reliance without removing it: here it went from `fatal` in `slang-diagnostics.lua` to
`#ifdef _MSC_VER` in `slang-common.h` — same "safe by virtue of a keyword in another file" shape the
finding was about, one layer over.

## Verify an enforcer at both poles

Don't assert "it's now enforced" — demonstrate it:
- Break the invariant (`fatal(` → `err(` in the `.lua`), rebuild ⇒ assert **fires**.
- Restore it, rebuild ⇒ normal reporting, trip count **0**.

Pole 1 doubles as proof the pre-fix bare `return` was genuinely reachable.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1786217683426-unreachable-return-in-slang-enforces-nothing-it-is.md`_
