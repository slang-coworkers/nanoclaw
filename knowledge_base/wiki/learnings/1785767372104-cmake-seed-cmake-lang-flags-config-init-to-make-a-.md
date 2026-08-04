---
title: "CMake: seed CMAKE_<LANG>_FLAGS_<CONFIG>_INIT to make a default flag user-overridable (not target_compile_options + detection)"
type: learning
topic: ci-tooling
source: learnings/1785767372104-cmake-seed-cmake-lang-flags-config-init-to-make-a-.md
---

# CMake: seed CMAKE_<LANG>_FLAGS_<CONFIG>_INIT to make a default flag user-overridable (not target_compile_options + detection)

## Context
slang#12223: `-Og` was injected into Debug builds via `target_compile_options(${target} PRIVATE $<$<CONFIG:Debug>:-Og>)`. CMake places target compile options AFTER `CMAKE_<LANG>_FLAGS` (env `CXXFLAGS`) and `CMAKE_<LANG>_FLAGS_<CONFIG>` on the compile line, so by last-`-O`-wins the injected `-Og` clobbered any user `-O` level — `CXXFLAGS='-O0 -g3' cmake ...` had no effect.

My draft PR #12234 fixed it by *detecting* a user `-O` (tokenize `CMAKE_CXX_FLAGS` + `CMAKE_CXX_FLAGS_DEBUG`, skip `-Og` if a whole `-O` token is present). Maintainer closed it unmerged: "doesn't quite seem to be the right fix." His replacement (#12324) is strictly better.

## The right mechanism
Seed **`CMAKE_C_FLAGS_DEBUG_INIT` / `CMAKE_CXX_FLAGS_DEBUG_INIT` before `enable_language()`**. These only *initialize* the corresponding cache variables, and `cmake_initialize_per_config_variable` sets them **without `FORCE`** — so a value supplied by the user, a preset, or a toolchain file simply replaces the default. The platform module still appends its own `-g`, so the default becomes `-Og -g`.

Why it beats detection:
- **No flag-string parsing at all.** No regex to get wrong (my first attempt's `(^| )-O([0-3sgz]|fast)?` missed `-O4`/`-O42` and false-positived on Clang's `-ObjC`; needed a `separate_arguments` tokenizer to fix).
- **Covers every language**, not just CXX. `target_compile_options` applies to all languages in the target but the detection only inspected CXX vars, so a C-only override was inconsistent.
- **Honors `CFLAGS`/`CXXFLAGS` generally**, not merely the `-O` token.
- Tradeoffs it accepts: guard must be `NOT WIN32` rather than a compiler-ID test (`CMAKE_CXX_COMPILER_ID` isn't set until `enable_language()`, necessarily after `_INIT` must be in place) — so MinGW loses `-Og`; and `CMAKE_<LANG>_FLAGS_<CONFIG>` is global, so in-tree deps also get `-Og` in Debug.

## The reasoning error to avoid (the real lesson)
I *did* evaluate "make `-Og` the default of `CMAKE_CXX_FLAGS_DEBUG`" and **rejected the whole direction after testing one bad variant**: `set(CMAKE_CXX_FLAGS_DEBUG "-g -Og" CACHE STRING "" FORCE)`. That variant genuinely fails (env `CXXFLAGS` lands in `CMAKE_CXX_FLAGS`, earlier on the line, so it still loses; and `FORCE` fights an explicit `-D`). From that single failure I concluded "defaults-based direction is dead" and pivoted to detection — never testing the `_INIT` + no-`FORCE` variant, which is the correct one.

**Generalize:** when a probe kills an approach, ask whether you disproved the *direction* or just the *one variant you tried*. Enumerate the mechanism's variants (here: `set(... FORCE)` vs `set(... CACHE)` vs `*_INIT` seeding pre-`enable_language()`) before writing the direction off. A negative result on one spelling is not a negative result on the concept.

## Also worth knowing
- Verifying a build-system change: no `tests/*.slang` applies. Use a throwaway project + `-DCMAKE_EXPORT_COMPILE_COMMANDS=ON` under the real generator (`Ninja Multi-Config`) and read the per-config entry of `compile_commands.json`; use `cmake -P` for pure predicate/regex unit checks (no compiler needed).
- CMake compile-line order is `CMAKE_<LANG>_FLAGS` → `CMAKE_<LANG>_FLAGS_<CONFIG>` → target `COMPILE_OPTIONS`. Env `CXXFLAGS` lands in the FIRST slot, so it can never win an `-O` fight against anything appended later. Any "let the user override our default flag" design must therefore either not append, or set the default at the variable-initialization layer.
- `CMAKE_CXX_FLAGS_DEBUG` default on ordinary GCC/Clang is just `-g`; the `-O0` people associate with Debug is the compiler's *implicit* default, not a literal token.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1785767372104-cmake-seed-cmake-lang-flags-config-init-to-make-a-.md`_
