---
title: "CORRECTION: CMAKE_&lt;LANG&gt;_FLAGS_&lt;CONFIG&gt;_INIT seeding does NOT let env CXXFLAGS override an -O default"
type: learning
topic: ci-tooling
source: learnings/1785768108214-correction-cmake-lt-lang-gt-flags-lt-config-gt-ini.md
---

# CORRECTION: CMAKE_&lt;LANG&gt;_FLAGS_&lt;CONFIG&gt;_INIT seeding does NOT let env CXXFLAGS override an -O default

## Correction to an earlier learning
My earlier note ("CMake: seed `CMAKE_<LANG>_FLAGS_<CONFIG>_INIT` to make a default flag user-overridable", slang#12223 / PR #12324) repeated the claim — taken from the PR body, **not probed** — that `_INIT` seeding "honors `CFLAGS`/`CXXFLAGS` generally". **That is wrong for an `-O` level.** Corrected here; prefer this note.

## What I measured
Replicated the mechanism exactly (seed `CMAKE_C_FLAGS_DEBUG_INIT`/`CMAKE_CXX_FLAGS_DEBUG_INIT` with `-Og` before `enable_language()`, no target-level append), Ninja Multi-Config, GCC 12.2, reading the Debug entry of `compile_commands.json`:

| configure input | Debug `-O`/`-g` flags | user's `-O` wins? |
|---|---|---|
| *(none)* | `-Og -g` | — (default applied) |
| env `CXXFLAGS='-O0 -g3'` | `-O0 -g3 -Og -g` | **NO — seeded `-Og` still wins** |
| `-DCMAKE_CXX_FLAGS_DEBUG='-O0 -g3'` | `-O0 -g3` | yes (cache var replaced) |

## Why
CMake's compile line is `CMAKE_<LANG>_FLAGS` → `CMAKE_<LANG>_FLAGS_<CONFIG>` → target `COMPILE_OPTIONS`. Env `CXXFLAGS` lands in **`CMAKE_<LANG>_FLAGS`, the FIRST slot**. Moving the default from a target option into `CMAKE_<LANG>_FLAGS_<CONFIG>` moves it from slot 3 to slot 2 — still *after* slot 1, so by last-`-O`-wins it continues to beat an env `-O`. The `_INIT` mechanism's real (and genuinely valuable) property is different: `cmake_initialize_per_config_variable` sets the cache var **without `FORCE`**, so an explicit **`-D<var>=`, preset, or toolchain** value *replaces* the default instead of being appended to.

## What to take away
- `_INIT` seeding is the right way to make a default **per-config** flag replaceable by cache/preset/toolchain, and it removes any need to parse user flag strings (no `-O4`/`-ObjC` regex edge cases) and covers all languages at once. Those are real wins.
- It does **not** make env `CFLAGS`/`CXXFLAGS` win an `-O` fight against your default. Non-`-O` env flags (`-march=native`) pass through either way — they were never in conflict.
- If the requirement is literally "`CXXFLAGS='-O0 -g3' cmake ...` must give me `-O0`", neither `_INIT` seeding nor a target-level append delivers it on its own; you need to *not* emit a competing `-O` after slot 1 (i.e. detect-and-skip), or document `-DCMAKE_CXX_FLAGS_DEBUG=` as the supported override.
- **Process lesson:** I asserted the env-var behavior by repeating a PR description instead of probing it — right after recording a lesson about not writing off a mechanism from one untested assumption. Probe the *replacement* implementation too, not just your own. A one-minute throwaway CMake project settles it.

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785768108214-correction-cmake-lt-lang-gt-flags-lt-config-gt-ini.md`_
