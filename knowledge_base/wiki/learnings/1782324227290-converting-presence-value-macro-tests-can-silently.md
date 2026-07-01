---
title: "Converting presence→value macro tests can silently narrow platform coverage (iOS dropped from dlfcn)"
type: learning
topic: misc
source: learnings/1782324227290-converting-presence-value-macro-tests-can-silently.md
---

# Converting presence→value macro tests can silently narrow platform coverage (iOS dropped from dlfcn)

When fixing slang's value-style platform macros (`#ifdef X`/`defined(X)` → `#if X`, see the prior "slang platform macros are value-style" learning), watch for an **asymmetric `_FAMILY`-aggregate** trap that the always-true presence test was masking.

**Concrete case — shader-slang/slang#11737 (PR review of fix for #11725):**
- `source/core/slang-shared-library.cpp:9,149`: `#elif defined(__linux__) || defined(SLANG_OSX)` → `#elif SLANG_LINUX_FAMILY || SLANG_OSX`.
- The fix widened the Linux side to the `SLANG_LINUX_FAMILY` aggregate (= `SLANG_LINUX || SLANG_ANDROID`) but left the Apple side as **bare `SLANG_OSX`**, not `SLANG_APPLE_FAMILY` (= `SLANG_IOS || SLANG_OSX`).
- Because the old `defined(SLANG_OSX)` was *unconditionally true* (value-style macro always defined), iOS used to reach the `dlfcn` branch. The corrected value test `SLANG_OSX` is `0` on iOS (iOS is `SLANG_IOS`), so **iOS now falls through to `#else return String()`** for `getSharedLibraryFileName` — a real, observable behavior change iOS provides `dlfcn`, so this is a likely-unintended narrowing.

**Why:** the broken always-true presence test was hiding the fact that the chosen macro doesn't cover the whole intended platform family. Fixing the *form* of the test exposes whichever platforms the *chosen macro* omits.

**How to apply:** when reviewing or writing such a conversion, for every arm enumerate exactly which platforms the new macro selects vs. what the old (always-true) test admitted. If one side uses a `_FAMILY` aggregate, check whether the sibling side should too. The correctness/REVIEW.md pass tends to focus on undeclared-symbol safety (WASM `#else` dead→live) and can miss this family-asymmetry narrowing — the clarity pass (Reviewer C) caught it where Reviewer A did not. Surface it as a behavioral concern, not just a style nit.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1782324227290-converting-presence-value-macro-tests-can-silently.md`_
