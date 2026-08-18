---
title: "-Og Debug builds (#12140) break debugging → gate behind SLANG_ENABLE_* option; default is a design gate (#12223)"
type: learning
topic: slang-compiler
source: learnings/1784925326386-og-debug-builds-12140-break-debugging-gate-behind-.md
---

# -Og Debug builds (#12140) break debugging → gate behind SLANG_ENABLE_* option; default is a design gate (#12223)

**Issue #12223** (regression/med/P2, build-system): after **PR #12140** (MERGED 2026-07-17, commit `d9c9fa4`, author skiminki-nv), GCC/Clang **Debug** builds compile at `-Og` instead of `-O0`, causing `<optimized out>` locals and single-steps that jump across functions (reporter juliusikkala, GCC 15.3.0). Reverting #12140 restores debugging.

**Mechanism (verified from source, `cmake/CompilerFlags.cmake:195` in `set_default_compile_options`):**
```cmake
if(CMAKE_CXX_COMPILER_ID MATCHES "GNU|Clang" AND NOT MSVC)
    target_compile_options(${target} PRIVATE $<$<CONFIG:Debug>:-Og>)
endif()
```
`-Og` is appended **after** `CMAKE_CXX_FLAGS_DEBUG` (`-O0 -g`), so by **last-`-O`-wins** the Debug config actually compiles at `-Og`. `-Og` permits inlining + variable-lifetime/range opts + line-table reordering — exactly the reporter's symptoms, worse on newer GCC. There is **no opt-out** today short of editing source.

**Triage learnings:**
1. **Fix mechanism is settled but the default is a maintainer design gate.** Gate `-Og` behind a new `option(SLANG_ENABLE_DEBUG_OPTIMIZATION ...)` `AND`-ed into the existing guard — mirrors the established `SLANG_ENABLE_RELEASE_LTO` / `SLANG_ENABLE_RELEASE_DEBUG_INFO` opt-in/opt-out convention (DeepWiki-confirmed pattern). The **only** open question is the default: ON (opt-out, keeps #12140's benchmarked ~4× Debug-build speedup for CI) vs OFF (opt-in, a config named "Debug" is debuggable by default; `RelWithDebInfo` already = fast+debug-info). Straight revert discards a benchmarked win — not recommended. When two core MEMBERs (reporter vs PR author) have opposing values, PARK-at-triaged + forward the fixer handoff as **HELD/do-not-implement** rather than baking in an unresolved default.
2. **Reproducing a build-flag regression's *severity* needs the reporter's toolchain.** The flag change itself is verifiable from source (→ don't need a build to confirm the cause), but the `<optimized out>` severity scales with optimizer aggressiveness (GCC 15) + full-codebase complexity. On GCC 12 + a trivial file, `-Og` only mildly perturbs the DWARF line table. So: confirm the CAUSE from source and label `regression`, but withhold `reproduced` and label the symptom-severity a hypothesis when you can't match the reporter's GCC version / do a full Debug build.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1784925326386-og-debug-builds-12140-break-debugging-gate-behind-.md`_
