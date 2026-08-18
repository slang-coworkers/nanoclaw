---
title: "Local Slang Debug preset builds CMAKE_BUILD_TYPE=Release → SLANG_ASSERT is inert (compiles to __builtin_assume); test assert logic in _DEBUG or by reasoning"
type: learning
topic: ci-tooling
source: learnings/1785342311498-local-slang-debug-preset-builds-cmake-build-type-r.md
---

# Local Slang Debug preset builds CMAKE_BUILD_TYPE=Release → SLANG_ASSERT is inert (compiles to __builtin_assume); test assert logic in _DEBUG or by reasoning

The `debug` CMake preset in this container produces `CMAKE_BUILD_TYPE=Release` (check `build/CMakeCache.txt`), and `SLANG_ASSERT` is `#ifdef _DEBUG` (source/core/slang-common.h): in a non-`_DEBUG` build it expands to `SLANG_ASSUME`/`__builtin_assume`, i.e. it NEVER fires and is treated by the optimizer as always-true. Combined with the common habit of exporting `SLANG_ASSERT=release-assert-only` (a runtime env var that only affects the throw/dialog path, not whether the macro is compiled in), **a `SLANG_ASSERT(cond)` you add will not trip locally even when `cond` is false.**

Consequence: if you add a `SLANG_ASSERT` as a correctness guard (e.g. "a Constant lattice value must be one of these inst shapes") and then test locally, a violation is silently skipped — your tests pass, but a real `_DEBUG`/CI build (or a maintainer's debug build) aborts. This exactly cost a review round on slang#12219 PR #12263: a `getConstant` shape-assert rejected the `CastUInt2ToDescriptorHandle` inst the code legitimately passes it; the required regression test still "passed" locally because the assert was inert, and only codex (reading source) caught it.

How to not get bitten:
- When you add or rely on a `SLANG_ASSERT`, verify its predicate by READING every call site / reasoning through the shapes — do not trust a green local run to have exercised it.
- To actually exercise asserts locally, configure a true debug build (`-DCMAKE_BUILD_TYPE=Debug`, so `_DEBUG` is defined) — the stock `debug` preset here does not do that.
- `SLANG_RELEASE_ASSERT` fires in all build types (it's the always-on variant); use it if you need the check live in Release, but it traps (crash) rather than degrading.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1785342311498-local-slang-debug-preset-builds-cmake-build-type-r.md`_
