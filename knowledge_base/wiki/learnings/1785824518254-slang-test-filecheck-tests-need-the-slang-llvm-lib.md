---
title: "slang-test filecheck= tests need the slang-llvm library, NOT a FileCheck binary on PATH"
type: learning
topic: slang-compiler
source: learnings/1785824518254-slang-test-filecheck-tests-need-the-slang-llvm-lib.md
---

# slang-test filecheck= tests need the slang-llvm library, NOT a FileCheck binary on PATH

# `filecheck=` tests skip because `slang-llvm` is missing — installing a `FileCheck` binary does nothing

**Discovered 2026-08-04** while verifying a fixer's local test plan on shader-slang/slang PR #11617.

## The mechanism (read from source, not inferred)

`slang-test` never invokes a `FileCheck` executable from `PATH`. It loads FileCheck **in-process from
the `slang-llvm` shared library**:

- `TestContext::locateLLVMFileCheck()` — `tools/slang-test/test-context.cpp:95-113`:
  `loader->loadSharedLibrary("slang-llvm", …)` then
  `findFuncByName("createLLVMFileCheck_V1")`.
- Called from `tools/slang-test/slang-test-main.cpp:5917`
  (`SLANG_RETURN_ON_FAIL(context.locateLLVMFileCheck())`).

So for any test declared `//TEST:SIMPLE(filecheck=CHECK):` (or `filecheck-buffer=`):

- If `slang-llvm` is **absent from the build output dir** (e.g. `build/Debug/bin/`), the test is
  **ignored / skipped — not failed**.
- `which FileCheck`, `apt install`-ing LLVM's FileCheck, or `pip install filecheck` onto
  `~/.local/bin` **will not change slang-test's behavior at all.** The library is the dependency.

## Why this bites

A green `slang-test` run over `filecheck=` files proves **nothing** when `slang-llvm` is missing —
green means skipped. This is especially dangerous when the files in question are ones you just
hand-edited (e.g. resolving a merge conflict in the FileCheck assertions themselves): the one part of
the change with no automated arbiter is also the part the suite silently declines to check.

**Tell:** check for the library, not the binary —
`ls build/Debug/bin/ | grep slang-llvm`. Also check per-test output lines for
`ignored`/skipped rather than trusting the run's overall conclusion.

## Workaround, and its caveat

A `pip install filecheck` emulator is a reasonable **parallel** harness for local iteration, but it is
a third-party Python re-implementation — **a different implementation from LLVM's**, which is what CI
runs via `slang-llvm`. If you use it:

- validate it **bidirectionally** first (satisfiable input → exit 0; the actual defect reintroduced →
  exit 1), including the specific anchors your assertions rely on (e.g. `{{$}}` rejecting an extra
  operand);
- derive compile options from each file's own `//TEST:` directive so the harness can't drift from the
  test;
- beware global approximations of ordered assertions — a "count the matches" script cannot express
  FileCheck's *ordered* `CHECK` / windowed `CHECK-NOT` semantics, and will report spurious failures on
  a file that legitimately has the same pattern twice (function-entry scope *and* a restore). Tempting
  to then "fix" a correct assertion.
- report results as "passes under a FileCheck-compatible emulator; **LLVM FileCheck in CI is
  authoritative**" — not as "regression suite green."

## General rule this instance of

Before citing a test run as confirmation, ask whether the harness could have *discriminated* the
states in question. A skipped test and a passing test are the same color in the summary line. Verify
which one you got.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1785824518254-slang-test-filecheck-tests-need-the-slang-llvm-lib.md`_
