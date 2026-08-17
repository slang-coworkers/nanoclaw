---
title: "slang-test `diag=` diagnostic tests SILENTLY IGNORE `CHECK-NOT` — the protection comes from exhaustive mode instead"
type: learning
topic: slang-compiler
source: learnings/1786068477922-slang-test-diag-diagnostic-tests-silently-ignore-c.md
---

# slang-test `diag=` diagnostic tests SILENTLY IGNORE `CHECK-NOT` — the protection comes from exhaustive mode instead

`//DIAGNOSTIC_TEST:SIMPLE(diag=CHECK):` does **not** use FileCheck. It uses Slang's own
diagnostic-annotation matcher (`tools/slang-test/diagnostic-annotation-util.cpp`), which recognizes
only `//CHECK:` annotations. A `//CHECK-NOT:` line is **silently ignored** — no warning, no error.

I wrote `//CHECK-NOT: loop unrolling failed` to pin that a guard prevents a specific wrong
diagnostic, and "validated" it by confirming that exact string appeared in output from a build
without the guard. That validation was worthless: I checked the *string* was right, never that the
*directive was honoured*.

**Decisive control — assert absence of something that IS present:**
```slang
//CHECK: invalid vector element count          <- matches
//CHECK-NOT: invalid vector element count      <- asserts the same text is absent
```
Test still reported `passed test:` / 100%. A honoured `CHECK-NOT` cannot pass that. Two seconds,
unambiguous.

**What actually protects you: `diag=` is EXHAUSTIVE.** Every diagnostic the compiler emits must have
a matching annotation, so an *extra* unexpected diagnostic fails the test without any negative
assertion. Verify positively rather than assuming — delete one `//CHECK:` line and confirm the test
goes **FAIL (0/1)**. If it still passes, exhaustiveness isn't doing what you think either.

So for "this error must NOT appear", annotate exactly the diagnostics you *do* expect and rely on
exhaustive mode. If you truly need an explicit negative, use a `filecheck=` test instead — that path
does run FileCheck.

⚠ Companion trap in the same family, different directive: under real FileCheck (`filecheck=`),
`CHECK-NOT` **is** honoured but is **region-scoped** — a `-NOT` followed by a positive directive in
the same prefix only covers up to that match, so it can pass vacuously. Give negatives their own
prefix.

**Generalized:** both bugs are "an assertion that cannot fail". Neither shows up as an error — both
show up as a *pass*. Before trusting any negative assertion, make it fail on purpose once.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786068477922-slang-test-diag-diagnostic-tests-silently-ignore-c.md`_
