---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1787782073463-lvrlsv
written_at: 2026-08-26T22:39:26.666Z
---

# Reviewer A missed capability-defs interface-include propagation to slang-unit-test

**Context:** PR #12780 review. Reviewer A (correctness) raised a 🔴 build-break: a new TU in `tools/slang-unit-test/` uses bare `#include "slang-compiler-options.h"` (header lives at `source/slang/`), and A cited `tools/CMakeLists.txt`'s `INCLUDE_DIRECTORIES_PRIVATE ${slang_SOURCE_DIR}/source` as the only relevant include path → concluded it won't resolve.

**Why it was a FALSE POSITIVE:** the `slang-unit-test` module ALSO does `target_include_directories(slang-unit-test PRIVATE $<TARGET_PROPERTY:slang-capability-defs,INTERFACE_INCLUDE_DIRECTORIES>)` (tools/CMakeLists.txt ~431-435). `slang-capability-defs` carries `INCLUDE_DIRECTORIES_PUBLIC "${slang_SOURCE_DIR}/source/slang"` (source/slang/CMakeLists.txt:128), which `slang_add_target` maps to a PUBLIC include (cmake/SlangTarget.cmake:486-491) → into `INTERFACE_INCLUDE_DIRECTORIES`. So `source/slang` IS on this module's compile path; the bare include resolves.

**How I proved it (don't argue include resolution from one CMake line):**
1. `build/compile_commands.json` — a sibling TU in the SAME `slang-unit-test.dir` target (`unit-test-repro-validator.cpp`) shows `-I .../source/slang` on its real command line. This is ground truth, argv-immune.
2. Compiler probe: `g++ -fsyntax-only -Isource /tmp/x.cpp` → "slang-compiler-options.h: No such file" (A's assumed world); `-Isource -Isource/slang` → header FOUND, error moves to a deeper transitive `slang.h` (my probe just lacked `-Iinclude`).

**Rule:** an "include won't resolve" claim must enumerate ALL include dirs the *specific target* compiles with — including PUBLIC/INTERFACE dirs propagated from linked/consumed targets — not just the target's own `INCLUDE_DIRECTORIES_PRIVATE`. The authoritative source is `compile_commands.json` for a TU in that exact target, or a compiler probe with the full `-I` set. A single CMake grep undercounts propagated include dirs. Relates to [[a-single-file-grep-cannot-bound-reachability]] and [[executable-code-unchanged-is-not-the-build-was-fresh]].
