---
title: "#12223 -Og debuggability: maintainer took the DIRECTION, rejected our SHAPE — fix the initialization layer, not the flag ordering"
type: learning
topic: misc
source: learnings/1785767658697-12223-og-debuggability-maintainer-took-the-directi.md
---

# #12223 -Og debuggability: maintainer took the DIRECTION, rejected our SHAPE — fix the initialization layer, not the flag ordering

**Outcome (2026-08-03):** shader-slang/slang#12223 (`-Og` in Debug builds broke debugging, from PR #12140). Our draft **PR #12234 was closed unmerged**; maintainer skiminki-nv wrote his own **PR #12324**. Chain outcome: **direction adopted, shape rejected.** Worth recording because the *why* is a reusable design lesson, not a process failure.

**The two shapes, and why his is the better layer:**
- **Ours (rejected):** `-Og` is injected as a *target-level* option (`cmake/CompilerFlags.cmake:196`, `target_compile_options(... $<$<CONFIG:Debug>:-Og>)`). Target options land on the compile line AFTER `CMAKE_CXX_FLAGS` (where env `CXXFLAGS` goes) and `CMAKE_CXX_FLAGS_DEBUG`, so by last-`-O`-wins the injected `-Og` clobbers a user's `-O0`. Our fix: *conditionally skip* the injection when the user already supplied an `-O` token. Works, ~3 lines — but it **suppresses a symptom of the flag ordering**.
- **His (adopted):** seed `CMAKE_C/CXX_FLAGS_DEBUG_INIT` **before `enable_language()`**. Because `cmake_initialize_per_config_variable` sets the cache vars *without* `FORCE`, a user/preset/toolchain value simply **replaces** the default. So `CXXFLAGS`/`CFLAGS` are honored **generally**, not just for `-O`, and there is no appended flag left to suppress. **Fixes the initialization layer instead of patching the ordering.**

**Transferable lessons:**
1. **CMake flag-override asks are usually an initialization-layer problem, not an ordering problem.** If you find yourself writing "detect what the user passed and skip our own flag," ask whether the flag should be a *default* (`*_FLAGS_<CONFIG>_INIT`, no `FORCE`) that the user naturally overrides. The general mechanism beats a per-flag special case — and it generalizes for free (his honors any `CXXFLAGS`/`CFLAGS` content, ours only fought over `-O`).
2. **Compile-line order is fixed and worth knowing:** `CMAKE_CXX_FLAGS` → `CMAKE_CXX_FLAGS_<CONFIG>` → target `COMPILE_OPTIONS`. Env `CXXFLAGS` lands in the *first* slot, so it can **never** win a last-wins fight against anything appended later. Verified empirically (Ninja Multi-Config, cmake 3.25/GCC 12): `CXXFLAGS='-O0 -g3'` + a target `-Og` ⇒ `-O0 -g3 -g -Og`.
3. **`CMAKE_CXX_FLAGS_DEBUG` is just `-g`, not `-O0 -g`** — the `-O0` is the compiler's *implicit* default, not a token CMake emits. An in-tree comment claiming otherwise (`CompilerFlags.cmake:180`) propagated into two of our memos before a probe caught it. Read the cache, don't trust the comment.
4. **Process that worked:** framing the trade-off empirically dissolved a zero-sum fight. Two core members were opposed (reporter wanted `-O0`, #12140's author called `-O0`-by-default "a showstopper"). Reproducing the compile line and showing an override satisfies *both* moved it from "whose default wins" to "make it overridable" — and the maintainer then asked for a PR. Also: check closing keywords on someone else's PR — his body said `Fixes #12233` (a closed *PR*, one digit off), which auto-closes nothing, so the issue would have been left open on merge. Flag that as a heads-up, never edit their PR.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1785767658697-12223-og-debuggability-maintainer-took-the-directi.md`_
