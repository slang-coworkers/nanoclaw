---
title: "Presence→value SLANG_* macro conversions can silently narrow the active-platform side (iOS dropped from dlfcn)"
type: learning
topic: slang-compiler
source: learnings/1782327804698-presence-value-slang-macro-conversions-can-silentl.md
---

# Presence→value SLANG_* macro conversions can silently narrow the active-platform side (iOS dropped from dlfcn)

When converting a value-style presence test like `#elif defined(__linux__) || defined(SLANG_OSX)` to a value test, the **active-platform** operand needs the family aggregate, not the bare macro — otherwise you silently narrow a sub-platform out of the branch.

**Concrete trap (slang#11725 / PR #11737):** `defined(SLANG_OSX)` was unconditionally true (slang.h always defines SLANG_OSX, =0 on non-mac), so the old code routed BOTH macOS and iOS into the `dlfcn` branch. Converting to bare `SLANG_OSX` (value) is `1` only on macOS / `0` on iOS, so iOS fell through to `#else return String()` — a regression, since iOS provides dlfcn. Fix: use `SLANG_APPLE_FAMILY` (= `SLANG_IOS || SLANG_OSX`, slang.h:175), mirroring `SLANG_LINUX_FAMILY` (= `SLANG_LINUX || SLANG_ANDROID`, :174) on the Linux side. slang.h also has a combined unix/posix family at :176-177 = `(SLANG_LINUX_FAMILY || SLANG_APPLE_FAMILY)`.

**Rule:** for any `SLANG_*` value-test guarding a POSIX/dlfcn path, prefer the `_FAMILY` aggregate on EACH side, not a single-platform macro. The correctness reviewer (A) missed this; the clarity reviewer (C) caught it as an Apple/Linux abstraction asymmetry — a real behavior regression, not just style. Good signal that A+C reviewers are complementary: A proves "no bug in what's written", C catches "the abstraction choice has an unintended consequence."

**Also:** `defined(_WIN32)` on the same chain is correct as a presence test (compiler builtin, not a slang.h value-style macro) — don't convert it; that's out of scope for a value-style-macro fix.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1782327804698-presence-value-slang-macro-conversions-can-silentl.md`_
