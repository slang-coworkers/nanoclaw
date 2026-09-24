---
title: "Xcode generator rejects any $<CONFIG:...> in a per-source COMPILE_OPTIONS (slang#13240)"
type: learning
topic: slang-compiler
source: learnings/1790175205051-xcode-generator-rejects-any-config-in-a-per-source.md
superseded_by: 1790177389937-xcode-cmake-generator-rejects-any-lt-config-gt-gen
---

# Xcode generator rejects any $<CONFIG:...> in a per-source COMPILE_OPTIONS (slang#13240)

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790172283353-s6krcj
written_at: 2026-09-23T14:53:25.051Z
---

# Xcode generator rejects any $<CONFIG:...> in a per-source COMPILE_OPTIONS (slang#13240)

**Symptom:** `cmake -GXcode` fails at *configure* with "Xcode does not support per-config per-source COMPILE_OPTIONS: <genex> specified for source: X.cpp". Ninja Multi-Config (Slang's `default` preset, used by all CI incl. the macOS `xcode-27` runner) tolerates it, so CI never catches it — the bug is generator-specific and macOS-only.

**Root cause (CMake source):** `cmGlobalXCodeGenerator` / `XCodeGeneratorExpressionInterpreter::Evaluate()` errors when a per-source `COMPILE_OPTIONS` genex has `GetHadContextSensitiveCondition()` true — i.e. it rejects on the **PRESENCE** of a `$<CONFIG:...>` condition, NOT on whether the resolved values differ across configs. So a genex that resolves config-independent (e.g. `-Oz` for all configs on Clang) STILL hard-errors just because `$<CONFIG:Debug>` appears in it.

**Fix pattern:** branch at configure time so only the path that genuinely needs per-config variation keeps the `$<CONFIG>` genex; give the others a plain, config-independent flag. In slang#13240 the `$<CONFIG:Debug>` carve-out was only for MSVC (Debug `/RTC1` vs optimization), so:
```
if(CMAKE_CXX_COMPILER_ID STREQUAL "MSVC")
    set(F "$<$<NOT:$<CONFIG:Debug>>:/O1;/Os>")
elseif(CMAKE_CXX_COMPILER_ID STREQUAL "GNU")
    set(F "-Os")
else()
    set(F "-Oz")   # Clang/AppleClang/clang-cl
endif()
```

**Two gotchas:**
1. Match `CMAKE_CXX_COMPILER_ID STREQUAL "MSVC"` (== `$<CXX_COMPILER_ID:MSVC>`), NOT the `MSVC` CMake variable — the latter is also true for clang-cl (compiler id `Clang`), so `if(MSVC)` would silently change clang-cl's flags.
2. To prove old-vs-new flag equivalence WITHOUT a 20-min slang build: `file(GENERATE)` can't evaluate `$<CXX_COMPILER_ID>` without a `TARGET` (throws "may only be used with binary targets", or crashes older CMake). Instead compile a trivial 2-target throwaway project replicating `set_source_files_properties(... COMPILE_OPTIONS ...)`, build `--config Debug`/`Release` verbose, and grep the actual `-O` flags per config.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790175205051-xcode-generator-rejects-any-config-in-a-per-source.md`_
