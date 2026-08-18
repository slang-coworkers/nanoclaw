---
title: "slang-glslang: add an opt-out via dedicated CMake escape-hatch, not by deleting the pass"
type: learning
topic: slang-compiler
source: learnings/1781975592365-slang-glslang-add-an-opt-out-via-dedicated-cmake-e.md
---

# slang-glslang: add an opt-out via dedicated CMake escape-hatch, not by deleting the pass

When a maintainer says "don't just delete the line — keep it toggleable for backward compatibility" about a `slang-glslang` SPIRV-Tools optimizer pass (or any build-time behavior), the house pattern is a **dedicated CMake `advanced_option`**, not a `#define` and not reusing a nearby flag. Mirror the existing `SLANG_ENABLE_SPIRV_OPT_MERGE_RETURN` template exactly (slang#11652 did this for `SLANG_ENABLE_SPIRV_OPT_PRIVATE_TO_LOCAL`):

1. `CMakeLists.txt`: `advanced_option(NAME "desc" ON|OFF)`.
2. `source/slang-glslang/CMakeLists.txt`: add `NAME=$<BOOL:${NAME}>` to `target_compile_definitions(slang-glslang PRIVATE ...)`.
3. `slang-glslang.cpp`: `#ifndef NAME` / `#define NAME 0|1` / `#endif` guard near the top, then wrap the registration(s) in `#if NAME ... #endif`. Wrap EVERY occurrence (incl. dead `#if 0`/`#else` history blocks) so the flag is the single source of truth.
4. `docs/building.md`: add an option-table row.
5. `.github/cmake-options-matrix.json`: add `{ "option": "NAME" }`.

Non-obvious gotchas:
- **Do NOT reuse an existing flag whose default contradicts your fix.** Check its default first. `SLANG_ENABLE_SPIRV_OPT_MERGE_RETURN` defaults ON (slang-glslang.cpp `#define ... 1`, CMake `TRUE`, CI passes `=ON`), so wrapping a bug-causing pass under it would leave the bug live by default. Pick the default by correctness: if pass-ON is the bug, default OFF (this inverts the MERGE_RETURN precedent, where pass-ON is correct and OFF is the workaround).
- **`cmake-options-build.yml` (consuming `cmake-options-matrix.json`) is BUILD-ONLY** — it configures+compiles each option set to the opposite of its default and runs NO `slang-test`. So a regression test that asserts the *default-build* SPIR-V (e.g. `%x = OpVariable %_ptr_Private_int Private`) is safe to add even though the matrix will build the flag=ON variant.
- **`docs/building.md` option table realigns every row** (prettier) when your new entry has the longest **option name** — the Option column widens for all rows. This is unavoidable, prettier-canonical churn; shortening the Description does not help.
- Surface the default value (ON vs OFF) as the maintainer's explicit call in your PR reply — it's a correctness-vs-output-stability tradeoff, not yours to assume.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1781975592365-slang-glslang-add-an-opt-out-via-dedicated-cmake-e.md`_
