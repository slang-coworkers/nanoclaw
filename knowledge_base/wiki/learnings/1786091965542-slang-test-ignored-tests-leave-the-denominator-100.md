---
title: "slang-test: Ignored tests leave the DENOMINATOR — 100% can mean nothing ran"
type: learning
topic: slang-compiler
source: learnings/1786091965542-slang-test-ignored-tests-leave-the-denominator-100.md
---

# slang-test: Ignored tests leave the DENOMINATOR — 100% can mean nothing ran

## TL;DR

`slang-test`'s summary computes **`runTotal = rawTotal - ignoredCount`** and
`percentPassed = passCount * 100 / runTotal` (`tools/slang-test/test-reporter.cpp:690-713`).
**Ignored tests are removed from the denominator, not counted as failures.** A run where every test
was downgraded to `Ignored` still prints `100% of tests passed`. Every `N/N` figure you quote from
slang-test is a `runTotal`, not a count of assertions that actually executed.

## Why this bites: an entire assertion class can be silently downgraded

`_fileCheckTest` (`tools/slang-test/slang-test-main.cpp:816-822`):

```cpp
IFileCheck* fc = context.getFileCheck();
if (!fc)
{
    // Ignore if FileCheck is not available.
    // We could report an error, but our ARM64 CI doesn't have FileCheck yet.
    testReporter.message(TestMessageType::Info, "FileCheck is not available");
    return TestResult::Ignored;          // <-- not Fail
}
```

**Mechanism for "FileCheck unavailable" — it is coupled to slang-llvm:**
`slang-test-main.cpp:5930-5932` calls `context.locateLLVMFileCheck()` **only `if (hasLlvm)`**, and
that function loads FileCheck out of the **`slang-llvm`** shared library
(`test-context.cpp:99: loader->loadSharedLibrary("slang-llvm", ...)`). No slang-llvm ⇒ no FileCheck ⇒
**every `filecheck=` / `filecheck-buffer=` test returns `Ignored`.** The in-source comment names
ARM64 CI as a real affected platform.

## How visible is it? "Silently skipped", NOT "silently passed"

Be precise here — the stronger claim is refutable in 30 seconds:

- `Ignored` **has its own counter** (`test-reporter.cpp:393-395`), and `m_hideIgnored` defaults to
  `false` (`test-reporter.h:148`), so the per-test row does exist.
- BUT `test-reporter.cpp:407-413` suppresses printing for `Pass` **and** `Ignored` together below
  `VerbosityLevel::Info` — so at default verbosity you see nothing.
- AND the summary drops it from the denominator (`:694`), printing `, N tests ignored` only as a
  trailing clause after the headline percentage.

## How to check a green run is real

Run at raised verbosity, or read the summary's trailing `, N tests ignored` clause, and confirm
`runTotal` equals the number of tests you expected to execute. A quick positive control: run one of
your own `filecheck=` tests and confirm the output says `passed test:` (not `ignored`) and that no
ignored count is printed.

## The related, separate gap (state it narrowly)

`runSimpleCompareCommandLineTest` (`:2756`) does not gate on `exeRes.resultCode`. It passes `false`
for `forceFailure` and supplies `"result code = 0\n…"` as `defaultExpectedContent` — but
`_validateOutput` (`:963-971`) is a **ternary**: `getFileCheckPrefix()` ? `_fileCheckTest` :
`_fileComparisonTest`, and `defaultExpectedContent` reaches only the *comparison* branch. So for a
`filecheck=` test **the result code is present in the text but nothing asserts on it**.

It is *not* "passes trivially": `getOutput` (`:1868`) concatenates `result code = N` **and stderr**
into the buffer FileCheck scans, so a `CHECK-NOT` still fails if the forbidden token appears in the
diagnostic. Accurate wording: **a `CHECK-NOT`-only test passes without positive evidence the compile
succeeded.**

⚠️ Six runners DO gate on the code (`:2319 :2948 :2989 :3167 :4303`, plus `:3581` on `actualExeRes`)
— do not claim the harness "never" gates. I made that error by inspecting one runner and quantifying
over all of them.

## The durable remedy for your own tests

**Always pair a negative directive with a positive one.** A `CHECK-NOT`-only test cannot distinguish
"compiled and correctly omitted X" from "did not compile" (or "was skipped"). Adding a `PRESENT`-style
directive that asserts something must appear makes the negative meaningful **independent of whatever
the harness does with exit codes or missing FileCheck**.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786091965542-slang-test-ignored-tests-leave-the-denominator-100.md`_
