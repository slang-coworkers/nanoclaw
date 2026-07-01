---
title: "SLANG_ASSERT=release-assert-only gives FALSE 'fixed' when triaging assert-failure ICEs"
type: learning
topic: slang-compiler
source: learnings/1781712984955-slang-assert-release-assert-only-gives-false-fixed.md
---

# SLANG_ASSERT=release-assert-only gives FALSE "fixed" when triaging assert-failure ICEs

When re-triaging a Slang crash whose signature is `assert failure: <cond>` (a `SLANG_ASSERT`-class ICE) to check if it's fixed at ToT, **do NOT run slangc with `SLANG_ASSERT=release-assert-only`**. That env value *skips* debug-only `SLANG_ASSERT`/`SLANG_ASSERT_FAILURE` checks — i.e. it suppresses the exact assertion the bug trips — so a still-buggy compiler will silently exit 0 and look "fixed."

**Why:** The default (env unset) behavior throws an exception on the assert, faithfully reproducing the original `error 99999: ... assert failure: <cond>`. `release-assert-only` only keeps `SLANG_RELEASE_ASSERT`. So for an `SLANG_ASSERT` ICE, unset = real signal, release-assert-only = false negative.

**How to apply:** Verify assert-ICE fixes with `SLANG_ASSERT` **unset** (or `system`/`debugbreak` if you need a stack). Reserve `release-assert-only` for getting *past* an unrelated debug assert to inspect later-stage output — never as the harness for the very assert you're testing. (Observed re-triaging #8148, an `assert failure: parentNonBlock` ICE — a release-assert-only run showed exit 0 on all three repros; rerunning with the env unset was required to trust the "fixed" result, which then held up against a force-rebuilt ToT binary.)

## release-assert-only also lies about true-Release crash semantics at a `SLANG_ASSERT(false)` catch-all

Beyond hiding the assert, `release-assert-only` actively mis-predicts optimized-Release behavior at a catch-all `SLANG_ASSERT(!"unimplemented...")` site: it SKIPS the check and then EXECUTES the fall-through code, often yielding clean/valid output. But a true optimized-Release build compiles `SLANG_ASSERT(false)` → `SLANG_ASSUME(false)` (UB the optimizer treats as unreachable) → heap corruption / SIGSEGV. So to confirm whether a reported *crash* still reproduces in shipped builds, **BUILD RELEASE** — don't infer it from a Debug binary with `release-assert-only`.

Concrete (#8870, HEAD 55a994460): `unorm float4` in a buffer hits the catch-all at `slang-type-layout.cpp:6180` (`_createTypeLayout` has no `ModifiedType` case for `UNormModifier`/`SNormModifier` under buffer layout). Debug (assert throws) → E99997, exit 255. Debug + `release-assert-only` → exit 0, *valid* SPIR-V (FALSE NEGATIVE). True optimized Release → `free(): invalid pointer` (exit 134) / SIGSEGV (exit 139) — matches the original report. `release-assert-only` is fine for "does this path get reached," but lies about release crash semantics at an assert-false site.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1781712984955-slang-assert-release-assert-only-gives-false-fixed.md`_
