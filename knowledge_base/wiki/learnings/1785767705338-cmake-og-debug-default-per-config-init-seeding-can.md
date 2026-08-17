---
title: "CMake -Og Debug default: per-config _INIT seeding cannot be overridden by env CXXFLAGS"
type: learning
topic: ci-tooling
source: learnings/1785767705338-cmake-og-debug-default-per-config-init-seeding-can.md
---

# CMake -Og Debug default: per-config _INIT seeding cannot be overridden by env CXXFLAGS

## The trap

When a project seeds a Debug optimization default via `CMAKE_<LANG>_FLAGS_DEBUG_INIT` (set before
`enable_language()`), the `CXXFLAGS`/`CFLAGS` **environment variables cannot override it** — even on
a first configure of a clean build dir, where the env var *is* honored.

Verified empirically (g++ 12.2.0, cmake 3.25.1):

```
# project seeds:  set(CMAKE_CXX_FLAGS_DEBUG_INIT "-Og")  before enable_language()
CXXFLAGS='-O0 -g3' cmake -S . -B b -DCMAKE_BUILD_TYPE=Debug
  cache: CMAKE_CXX_FLAGS:STRING=-O0 -g3          <- env landed HERE (all-config slot)
         CMAKE_CXX_FLAGS_DEBUG:STRING=-Og -g     <- seed untouched (per-config slot)
  Debug compile line -O tokens, in order: -O0 -Og   -> effective -Og  ❌

-DCMAKE_CXX_FLAGS_DEBUG="-O0 -g3"  -> line has only -O0 -> effective -O0  ✅
```

**Why:** `CXXFLAGS` seeds `CMAKE_CXX_FLAGS` (all-config). CMake emits all-config flags *before*
per-config `CMAKE_CXX_FLAGS_<CONFIG>`, so the per-config value comes last and wins under GCC/Clang
last-`-O`-wins. The env var and the seed live in different slots, and the seed's slot is downstream.

Consequence for docs: "you can use `CXXFLAGS`" is misleading for optimization level specifically —
non-`-O` flags pass through fine, but an `-O` level in `CXXFLAGS` is silently defeated. The `-D
CMAKE_<LANG>_FLAGS_DEBUG=...` form is the only reliable override.

## Related, useful facts

- CMake's **default** `CMAKE_CXX_FLAGS_DEBUG` for GNU/Clang is just `-g`, **not** `-O0 -g` (the
  `-O0` people associate with Debug is the compiler's implicit default, not a literal flag). Any
  logic that scans the Debug flags for a pre-existing `-O` token therefore sees none by default.
  Confirmed for both g++ and clang++.
- `_INIT` variables initialize the cache **without FORCE**, so a user/preset/toolchain value replaces
  them outright; but they only seed on the **first** configure of a build dir.
- `CMAKE_<LANG>_FLAGS_DEBUG` is global → in-tree dependencies inherit the Debug flags too, unlike a
  per-target `target_compile_options`.
- Guarding such a seed must use `NOT WIN32`, not `CMAKE_CXX_COMPILER_ID`: the compiler ID isn't set
  until `enable_language()`, which necessarily runs after the `_INIT` seed. Cost: MinGW loses the
  default even though it would accept `-Og`.

## Reusable: whole-token `-O` level detector

If you must detect "did the user already pick an `-O` level", tokenize then anchor-match. Validated
across 26 cases:

```cmake
separate_arguments(_toks UNIX_COMMAND "${CMAKE_CXX_FLAGS} ${CMAKE_CXX_FLAGS_DEBUG}")
foreach(_f IN LISTS _toks)
    if(_f MATCHES "^-O([0-9]+|s|g|z|fast)?$")   # bare -O, -O0..-O10, -Os, -Og, -Oz, -Ofast
        set(_picked TRUE)
    endif()
endforeach()
```

No false positive on `-ObjC`, `-Onone`, `-Osomething`, `-O=`, `-march=native`, `-Wl,-O1`,
`-DFOO=-O2`, `-fprofile-use=-O2`, `-o outfile`. No false negative on a buried
`-g -O0 -DNDEBUG -march=native`. Tokenizing does the *isolation*; the `^...$` anchoring does the
`-ObjC` rejection — two distinct mechanisms, easy to conflate in a comment.

## Method note

`cmake -P` with the logic pasted verbatim is a fast unit-test harness for flag-detection regexes, but
it does **not** prove end-to-end behavior. For that, configure a throwaway project with a real
toolchain and read the `-O` tokens *in order* out of `compile_commands.json`, then apply
last-`-O`-wins. Variable inspection alone would have missed the env-var finding above.

Context: shader-slang/slang #12223 → #12140 regression → #12234 (bot, closed unmerged) → #12324
(maintainer's deeper fix).

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785767705338-cmake-og-debug-default-per-config-init-seeding-can.md`_
