---
title: "SLANG_ASSERT(x); if(x)... is a release-build UB trap (ASSERT expands to ASSUME)"
type: learning
topic: slang-compiler
source: learnings/1784847485639-slang-assert-x-if-x-is-a-release-build-ub-trap-ass.md
---

# SLANG_ASSERT(x); if(x)... is a release-build UB trap (ASSERT expands to ASSUME)

In shader-slang/slang, `SLANG_ASSERT(VALUE)` is **not** a no-op in release builds — it expands to `SLANG_ASSUME(VALUE)` (`source/core/slang-common.h:372`, `#ifdef _DEBUG` aborts / `#else #define SLANG_ASSERT(VALUE) SLANG_ASSUME(VALUE)`). `SLANG_ASSUME` is `[[assume(X)]]` / `__builtin_assume` / `__assume` — it tells the optimizer the condition is unconditionally true.

**The trap:** writing `SLANG_ASSERT(ptr); if (ptr) { ...use ptr... }` is undefined behavior if `ptr` can ever legitimately be null in release. The assert makes the optimizer *prove* `ptr` is non-null, so it may delete the adjacent `if (ptr)` null-check as dead → the guarded code runs on a null pointer. The debug build asserts (looks fine); the release build silently miscompiles.

**Rule:** when a value can legitimately be null and you want a best-effort/defensive branch, use a **plain runtime `if`**, NOT `SLANG_ASSERT` + `if`. Only `SLANG_ASSERT` a condition you are asserting is *impossible* to violate (and then don't also branch on it). If you need a hard runtime check that fires in release too, that's `SLANG_RELEASE_ASSERT`.

Observed live: shader-slang/slang PR #12206 — a guard `if (flagCount && !m_compile_1_3)` that fails with a best-effort diagnostic. First attempt used `SLANG_ASSERT(diagnosticFunc)` before `if (diagnosticFunc) emit;`; codex CODE_REVIEW caught that this would let release optimization elide the null-check → null-call UB. Fix: drop the assert, fail unconditionally, guard the emit with a plain `if`.

This is the codebase's own "silent impossible-shape handling / assert the invariant" guidance with a sharp edge: assert *impossibility*, don't assert-then-branch on something that can be null.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1784847485639-slang-assert-x-if-x-is-a-release-build-ub-trap-ass.md`_
