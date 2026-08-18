---
title: "slang-test N of N is a runTotal with ignored tests removed from the denominator"
type: learning
topic: slang-compiler
source: learnings/1786092236462-slang-test-n-of-n-is-a-runtotal-with-ignored-tests.md
---

# slang-test N of N is a runTotal with ignored tests removed from the denominator

**Every `N/N` figure from `slang-test` is a `runTotal`, not a raw total. Ignored tests are subtracted from the denominator before the percentage is computed.**

```
tools/slang-test/test-reporter.cpp:694   runTotal = rawTotal - ignoredCount
                             :710       percentPassed = (passCount * 100) / runTotal
                             :713       printf("%d%% of tests passed (%d/%d)", percentPassed, passCount, runTotal)
                             :715       if (ignoredCount) printf(", %d tests ignored", ignoredCount)
```

⇒ **`100% of tests passed (573/573)` is compatible with an arbitrary number of tests having been downgraded to `Ignored` and removed from the count.** The headline figure is unaffected by mass downgrade.

## Why tests get downgraded, and on which platform

`_fileCheckTest` (`tools/slang-test/slang-test-main.cpp:816-822`) returns `TestResult::Ignored` — **not `Fail`** — when FileCheck is unavailable:

```cpp
IFileCheck* fc = context.getFileCheck();
if (!fc) {
    // Ignore if FileCheck is not available.
    // We could report an error, but our ARM64 CI doesn't have FileCheck yet.
    return TestResult::Ignored;
}
```

FileCheck is loaded from the **`slang-llvm`** library (`test-context.cpp:99`) and `locateLLVMFileCheck()` is called **only `if (hasLlvm)`** (`slang-test-main.cpp:5930-5932`). ⇒ **no slang-llvm ⇒ no FileCheck ⇒ every `filecheck=` / `filecheck-buffer=` test returns `Ignored`**, which is why ARM64 is the platform named in the source comment.

## The honest bound — state it or the claim dies to one grep

⚠️ **The ignored count IS disclosed, adjacent to the percentage** (`:715`, and `m_hideIgnored` defaults to `false` so the per-test row exists). So the accurate claim is **"silently skipped, not silently passed"**: the percentage is computed over a reduced denominator, the count is printed at the tail of the same line, and a reader who quotes only the percentage never sees it. It is **not** tallied as a pass — `Ignored` has its own `TestResult` and its own reporter cases.

⭐⭐⭐ **How to read the figure:** absence of `, N tests ignored` on the summary line is the evidence that FileCheck was present and the figure is real. A bare `573/573` quoted without that tail proves nothing about coverage.

⭐⭐ **Same shape as a GitHub Actions run reporting `success` above 34 skipped jobs** — an aggregate computed over the subset that ran. Whenever a tool reports a ratio, ask what left the denominator.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1786092236462-slang-test-n-of-n-is-a-runtotal-with-ignored-tests.md`_
