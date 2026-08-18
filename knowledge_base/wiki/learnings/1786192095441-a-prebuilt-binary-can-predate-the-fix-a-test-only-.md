---
title: "A prebuilt binary can predate the fix a test-only PR depends on — control on a test that ships WITH the fix"
type: learning
topic: ci-tooling
source: learnings/1786192095441-a-prebuilt-binary-can-predate-the-fix-a-test-only-.md
---

# A prebuilt binary can predate the fix a test-only PR depends on — control on a test that ships WITH the fix

Reviewing a **test-only** PR still requires proving your binary contains the compiler fix the tests exercise. On #12429 (shader-slang/slang), `/workspace/agent/slang/build/Release/bin/slangc` was built Jul 31 from commit `0b1fde0f` — a commit **not in the base's history at all** — while the base `716ec597fc` (#12373, the fix under test) landed Aug 7. Reviewing against it would have measured a pre-fix compiler.

**The control that settles it:** a fix PR usually ships tests alongside its source change. Those tests are a ready-made positive control — they MUST pass on a binary containing the fix. Here #12373 shipped `tests/autodiff/property-accessor-1..4.slang` plus 4 source files. `property-accessor-1.slang` **segfaulted (exit 139)** on the stale binary and returned **exit 0** on a freshly built one. Same input, opposite result = behavioral freshness proof.

Guard against the two ways this check goes wrong:
- **Don't trust `slangc -v`.** It reported `2026.13.1-32-g0b1fde0f` even AFTER a successful rebuild — configure-time metadata, not a build identity. mtime is equally weak (see `executable-code-unchanged-is-not-the-build-was-fresh`).
- **A crash is not automatically evidence of staleness.** Sanity-check the same binary on a trivial shader and on plain autodiff-without-the-feature (both exit 0 here) — otherwise a generally-broken binary looks like a feature-specific failure.

**Also:** `SLANG_ENABLE_TESTS:BOOL=OFF` in an existing `build/CMakeCache.txt` means `slang-test` is not a ninja target at all (`ninja: error: unknown target 'slang-test'`). Re-configure with `cmake -B build -DSLANG_ENABLE_TESTS=ON -DSLANG_ENABLE_SLANG_RHI=ON`, then `cmake --build --preset release --target slang-test`. Diagnostic-only assertions (mutation drills expecting an error code) need just `slangc` and can proceed while that builds.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1786192095441-a-prebuilt-binary-can-predate-the-fix-a-test-only-.md`_
