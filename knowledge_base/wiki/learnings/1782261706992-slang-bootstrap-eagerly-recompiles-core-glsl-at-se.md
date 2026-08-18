---
title: "slang bootstrap eagerly recompiles core+GLSL at session creation (EMBED_CORE_MODULE=OFF)"
type: learning
topic: slang-compiler
source: learnings/1782261706992-slang-bootstrap-eagerly-recompiles-core-glsl-at-se.md
---

# slang bootstrap eagerly recompiles core+GLSL at session creation (EMBED_CORE_MODULE=OFF)

**Context:** triage of shader-slang/slang#11717 (redundant core-module builds when `-DSLANG_EMBED_CORE_MODULE=OFF`). HEAD `f1142612a`.

**Finding (non-obvious):** `slang-bootstrap` links `slang-without-embedded-core-module` (`tools/CMakeLists.txt:81-95`, built with `SLANG_BOOTSTRAP=1`), so `slang_getEmbeddedCoreModule()` returns null. In `slang_createGlobalSessionImpl` (`source/slang/slang-api.cpp:183-248`), the cache-load path is gated by `if (!internalDesc->isBootstrap)` (`:196` core, `:223` GLSL), so in bootstrap mode it falls straight through to `compileBuiltinModule(Core)` (`:207-208`) and `compileBuiltinModule(GLSL)` (`:238-239`). i.e. **every `slang-bootstrap` process eagerly compiles core (+GLSL, since slangc main.cpp:94 sets enableGLSL) from source at session-creation time, before any command-line option is processed.** `isBootstrap` is set at `source/slangc/main.cpp:96-97`.

**Why it matters for any "reuse the compiled core" fix:** the build invokes bootstrap twice when EMBED_CORE_MODULE=OFF — once for the generated core+GLSL headers (`source/slang-core-module/CMakeLists.txt:137-157`, a single call producing both; GLSL does NOT recompile separately) and again for `slang.neural` (`source/standard-modules/neural/CMakeLists.txt:48-95`, a second bootstrap process). Each pays a full core+GLSL recompile. Passing `-load-core-module <archive>` to the neural step **alone is likely insufficient** — the eager compile already ran during session creation before the command line is honored. A real dedupe must teach the bootstrap session-init path to load an explicitly-provided, same-build core archive ahead of the eager `compileBuiltinModule`. The serialized-archive options already exist: `-save-core-module`, `-load-core-module`, `-save-core-module-bin-source` (`source/slang/slang-options.cpp:1201-1216`). Same-build provenance preserves the no-core-mismatch guarantee the neural step's slangc-avoidance comment (`neural/CMakeLists.txt:49-54`) depends on. A second, VS/MSBuild-only redundancy (the core-header custom command running more than once via multiple target traversals) is orthogonal and needs an MSBuild repro to confirm — it does not occur with Ninja.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1782261706992-slang-bootstrap-eagerly-recompiles-core-glsl-at-se.md`_
