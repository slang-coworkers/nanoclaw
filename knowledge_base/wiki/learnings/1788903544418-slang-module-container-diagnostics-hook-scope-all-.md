---
title: "Slang module-container diagnostics: hook scope, all 4 extensions, and warning-disable id vs name"
type: learning
topic: slang-compiler
source: learnings/1788903544418-slang-module-container-diagnostics-hook-scope-all-.md
---

# Slang module-container diagnostics: hook scope, all 4 extensions, and warning-disable id vs name

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1788897517347-te4w4q
written_at: 2026-09-08T21:39:04.418Z
---

# Slang module-container diagnostics: hook scope, all 4 extensions, and warning-disable id vs name

From fixing shader-slang/slang#12966 (warn when slangc writes a `.slang-module`). Several non-obvious gotchas when adding a diagnostic to the CLI module-write path:

1. **All FOUR extensions map to `ContainerFormat::SlangModule`**: `.slang-module`, `.slang-lib`, `.zip`, AND `.dir` (`OptionsParser::addOutputPath`, `slang-options.cpp:~1912`). When scanning for regressions from a new module-write diagnostic, grep tests for `-o *.{slang-module,slang-lib,zip,dir}` — scanning only `.slang-module`/`.slang-lib` misses `.zip`/`.dir` producers (I missed `tests/feature/source-map/emit-source-map.slang`, a `.zip` producer, on the first pass — caught by codex OUTPUT_REVIEW). Use extension-neutral message wording ("a compiled Slang module"), not an enumeration.

2. **`EndToEndCompileRequest::maybeCreateContainer()` runs for the programmatic API too**, not just slangc — it's called unconditionally at end-of-compile (`slang-end-to-end-request.cpp:~1235`) and in the `-no-codegen`/`SkipCodeGen` branch (`:222`); only the file *write* (`maybeWriteContainer`) is gated on `m_isCommandLineCompile`. Gate CLI-only diagnostics on `m_isCommandLineCompile` INSIDE the hook, or you'll emit into API embedders' builds and trip their warnings-as-errors. `m_isCommandLineCompile` is set by slangc/slang-test/test-server and the public `spSetCommandLineCompilerMode()` (`source/slangc/main.cpp:25` in `_compile()`).

3. **`slang-bootstrap` builds the bundled standard modules in command-line mode** (it IS `source/slangc/main.cpp` compiled with `SLANG_BOOTSTRAP`), so any CLI-mode module-write diagnostic shows up 2× during a normal build (generating `neural.slang-module` + `workgraph.slang-module`). Suppress it in `source/standard-modules/{neural,experimental}/CMakeLists.txt` gen commands.

4. **`-warnings-disable` accepts a numeric id OR a name**, with different failure modes: an unknown *numeric* id is silently ignored (safe to share across compiler versions → use `-warnings-disable 88` in CMake for cross-compile robustness with an older `SLANG_GENERATORS_PATH` bootstrap); an unknown *name* errors with E31111 "unknown diagnostic" (self-documenting → use the name in tests).

5. **Diagnostic codes render zero-padded to 5 digits** (`slang-rich-diagnostics-render.cpp:~803`): code 88 → `warning[E00088]`. FileCheck the bracketed code + message text; a bare `CHECK: warning 88` can pass vacuously.

6. **`-no-codegen` is a debug path that swallows escalated errors**: it returns `SLANG_OK` (`:226`) without the sink-error check the normal path has (`:318`), so `-no-codegen -warnings-as-errors` emits the error but exits 0. Pre-existing; the normal module-write path exits non-zero correctly.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1788903544418-slang-module-container-diagnostics-hook-scope-all-.md`_
