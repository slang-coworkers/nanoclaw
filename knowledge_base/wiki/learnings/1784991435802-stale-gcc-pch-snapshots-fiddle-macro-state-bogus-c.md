---
title: "Stale GCC PCH snapshots FIDDLE macro state → bogus codegen errors (slang#12227)"
type: learning
topic: slang-compiler
source: learnings/1784991435802-stale-gcc-pch-snapshots-fiddle-macro-state-bogus-c.md
---

# Stale GCC PCH snapshots FIDDLE macro state → bogus codegen errors (slang#12227)

**Symptom:** On GCC/Linux **Debug incremental** builds (Ninja Multi-Config, `SLANG_ENABLE_PCH=ON` by default), ~400 bogus compile errors that LOOK like FIDDLE codegen bugs — e.g. `expected unqualified-id before 'private'` inside `slang-ir-insts.h.fiddle`, cascading into incomplete-type errors for `IRFieldAddress`/`IRMakeStruct`. **The tell:** the diagnostic `#include` chain starts `<command-line>` → `cmake_pch.hxx`. The generated `.fiddle` output is CORRECT (byte-identical to a clean-building machine).

**Root cause (verified @HEAD 5281ccc66):** The precompiled header snapshots FIDDLE's *transient* preprocessor state. The PCH headers are `slang-basic.h` + `slang-compiler.h` (`source/slang/CMakeLists.txt:263-264`, target = OBJECT lib `slang-common-objects`). `slang-compiler.h` → `slang-syntax.h` → `slang-ast-builder.h` → AST headers (`slang-ast-base.h`, `slang-ast-val.h`, ...) which each `#include` a `.fiddle`. Every `.fiddle` prologue does `#undef FIDDLE/FIDDLEX/FIDDLEY` then `#define FIDDLEY(ARG) FIDDLE_##ARG` / `#define FIDDLE FIDDLEX(__LINE__)` + `FIDDLE_<line>` macros keyed on `__LINE__`. A `.gch` bakes in that macro state.

**Why the build graph doesn't catch a stale/inconsistent `.gch`:** invalidation is purely mtime-based, but (1) `File::writeAllTextIfChanged` (`source/core/slang-io.cpp:1211`) skips writes when content is identical, so unchanged `.fiddle` files keep OLD mtimes; (2) the `.fiddle` files are declared `BYPRODUCTS` (mtimes intentionally NOT up-to-date markers) — the custom command is driven by an unconditionally-`touch`ed `.fiddle.stamp` (`source/slang/CMakeLists.txt:44-61`); (3) the PCH's dep on `slang-fiddle-output` is **order-only** (`LINK_WITH_PRIVATE`, `:273`). `-Winvalid-pch` does NOT fire — GCC considers the `.gch` structurally valid.

**Workaround:** `rm build/source/slang/CMakeFiles/slang-common-objects.dir/Debug/cmake_pch.hxx.gch && cmake --build --preset debug`, or configure `-DSLANG_ENABLE_PCH=OFF`.

**Fix directions (triaged, none landed as of 2026-07-25):** A) `SKIP_PRECOMPILE_HEADERS` on FIDDLE-heavy TUs — mirrors the EXISTING `slang-rich-diagnostics.cpp` precedent (`CMakeLists.txt:85-90`, though that one's rationale is an MSVC opt-level conflict, C4653 — a different reason). B) explicit (non-order-only) stamp→PCH dep — NOT great: forces a 258MB PCH rebuild every fiddle run, and per the reporter's timeline fiddle didn't even re-run before the bad `.gch`, so it wouldn't have prevented the reported instance. C) most principled: have each `.fiddle` epilogue leave `FIDDLE`/`FIDDLEX`/`FIDDLEY` `#undef`'d so any PCH snapshot is consistent — but needs a reproducer for HOW the `.gch` goes bad (undetermined). D) emit a loud `#error`-style guard from the generated `.fiddle` on mis-scoped expansion instead of a 400-line cascade.

**Meta:** two independent bugs get conflated here — how a bad `.gch` is CREATED (nondeterministic, undetermined) vs. how it PERSISTS + mis-diagnoses (fully understood). Also: `slang-fiddle` `main()` returns 0 even on `sink.getErrorCount()>0` (`tools/slang-fiddle/slang-fiddle-main.cpp:453`) — the #12212 sibling latent bug, not the cause here but worth hardening. Triaged as build-system bug / medium / P2, Issue Type Build; parked for maintainer (assignee jkwak-work) to pick a direction — it's a PCH-speed-vs-robustness values call.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784991435802-stale-gcc-pch-snapshots-fiddle-macro-state-bogus-c.md`_
