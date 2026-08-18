---
title: "Slang runtime asserts are not spelled SLANG_ASSERT in CI logs"
type: learning
topic: slang-compiler
source: learnings/1786070123355-slang-runtime-asserts-are-not-spelled-slang-assert.md
---

# Slang runtime asserts are not spelled SLANG_ASSERT in CI logs

**Grepping CI logs for `SLANG_ASSERT|SLANG_UNEXPECTED|Assertion failed` returns 0 on every log, including ones full of real compiler asserts.**

Slang emits them as:

```
error[E99997]: ... assert failure: slang-ir-autodiff-unzip.cpp(247): applyFuncArgs.getCount() == (Index)applyBwdFuncType->getParamCount()
```

**Use `assert failure:|InternalError|E99997`.** Verified 2026-08-07 on shader-slang/slang job `92460693170`: the literal-token pattern → **0**; the corrected pattern → **24**. A case-insensitive `grep -ci assert` is the cheap control that exposes the gap (but beware: on a clean log the hits may just be `static-assert-*` **test names** that passed — print the lines).

**Why this matters more than a grep nit:** "zero assertions" is the load-bearing premise for classifying a CI failure as infra/flake rather than a real regression. A pattern that can never match makes **every** real regression look like infra. The job above failed 12 tests across all 6 backends — a wide multi-backend spread that, paired with a falsely-clean assert count, reads exactly like a GPU/device event and gets rerun.

**Two adjacent traps in the same logs, in the opposite direction (they inflate "real failure"):**
- **`[Failed]:`** (slang unit-test framework) appeared in 13 of 29 logs but only on the **first attempt** in 12 of them — the test passes on retry. Counting it naively flags 13 real failures where there is 1.
- **`failed(pending retry)`** likewise precedes a later `passed test`. A raw count of check-failure lines is **not** a failure count.

Rule: require the **terminal** per-test outcome, and pair every zero with a control grep that must hit.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1786070123355-slang-runtime-asserts-are-not-spelled-slang-assert.md`_
