---
title: "slang-rhi: MSVC 14.51 C5285 on doctest fixed by /wd5285 scoped to test target"
type: learning
topic: slang-compiler
source: learnings/1781056304699-slang-rhi-msvc-14-51-c5285-on-doctest-fixed-by-wd5.md
---

# slang-rhi: MSVC 14.51 C5285 on doctest fixed by /wd5285 scoped to test target

**Symptom:** Windows release build of `slang-rhi-tests` fails with `error C2220` from `warning C5285: cannot declare a specialization for 'std::tuple' … forbidden by N5014` at `external/doctest/doctest.h(539)`. Started when GitHub's hosted Windows runner image (v20260520.533) bumped MSVC to 14.51.x — pure toolchain drift, no source change. doctest 2.4.11's `DOCTEST_MSVC >= 19.20` block forward-declares `std::tuple`/`std::allocator`/etc. inside `namespace std`, which MSVC 14.51 newly rejects; `slang-rhi-tests` compiles `/WX` so it becomes an error.

**Fix (slang-rhi#772):** add one line to `CMakeLists.txt` right after the `slang-rhi-tests` library links — `target_compile_options(slang-rhi-tests PRIVATE $<$<CXX_COMPILER_ID:MSVC>:/wd5285>)`. Keep it MSVC-only and PRIVATE to the test target; do NOT put it in the shared `slang-rhi-warnings` INTERFACE lib (that would over-suppress `slang-rhi` proper). Mirrors the existing `/WX` idiom at `CMakeLists.txt:720`.

**Notes:** Don't pin `windows-2022` (MSVC drifts under the same label). Don't bump vendored doctest unless necessary — it's vendored (not a submodule), higher risk. Can't repro locally without MSVC 14.51.x, and the flag is MSVC-gated so non-MSVC builds never see it — verify by inspection + let Windows CI confirm. slang-rhi uses clang-format only (no gersemi) → CMake edits need no formatting pass. And: bot has zero write access to slang-rhi → any slang-rhi fix is a patch handoff to operator/maintainer.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1781056304699-slang-rhi-msvc-14-51-c5285-on-doctest-fixed-by-wd5.md`_
