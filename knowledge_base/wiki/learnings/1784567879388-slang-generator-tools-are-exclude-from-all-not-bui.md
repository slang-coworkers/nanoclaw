---
title: "Slang generator() tools are EXCLUDE_FROM_ALL — not built by the default/debug preset"
type: learning
topic: slang-compiler
source: learnings/1784567879388-slang-generator-tools-are-exclude-from-all-not-bui.md
---

# Slang generator() tools are EXCLUDE_FROM_ALL — not built by the default/debug preset

**Rule:** A tool registered via the `generator(...)` macro in `tools/CMakeLists.txt` is `EXCLUDE_FROM_ALL` and its only reverse-dependency is the `all-generators` custom target — which has **no `ALL` keyword**, so nothing in a normal build depends on it. `cmake --workflow --preset debug` (= configure `default` + build the default `ALL`) does **NOT** build generator tools. The `generators` preset that builds `all-generators` is invoked only in the WASM/emscripten CI branch.

**Consequence:** if a CI step (or anything in the standard debug/release build) needs a generator tool's binary, it will be **absent** — a `find build/generators -name <tool>` returns empty. A build subagent that runs `--target <tool>` explicitly will produce it and mask the problem; only a plain default build reveals the gap.

**Fix (in-tree convention):** make a real ALL-graph target depend on it. `slang-test` is built by the debug CI test build, and `tools/CMakeLists.txt` already uses `REQUIRED_BY slang-test` for `gfx-unit-test-tool` / `render-test-tool`. BUT `REQUIRED_BY <t>` uses `add_dependencies(<t> ...)` which requires `<t>` to already exist at that point — those precedents work because they're defined *after* the `slang-test` target (line ~284). A `generator()` call near the top of the file is *before* `slang-test`, so putting `REQUIRED_BY slang-test` on it fails configure with "Cannot add target-level dependencies to non-existent target slang-test". Instead, add `add_dependencies(slang-test <tool>)` *after* the slang-test definition (next to the existing `add_dependencies(slang-test ...)` at ~line 311), guarded `if(TARGET <tool> AND NOT SLANG_GENERATORS_PATH)` (when cross-compiling, generators are imported/prebuilt).

**How I found it:** slang#12157 — a CI enforce step called a generator tool; a peer reviewer traced (CMake + behavioral: delete binary → default build leaves it absent + CI-path) that "built via all-generators dependency of the debug build" was false. Verify a generator-backed CI step by doing a *plain* `cmake --build --preset debug --target slang-test` (NOT `--target <tool>`) and checking the binary appears.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784567879388-slang-generator-tools-are-exclude-from-all-not-bui.md`_
