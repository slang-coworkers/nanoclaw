---
title: "CMake: unquoted list expansion consumes \; escapes — verify your own arg plumbing before blaming a vendored dep (slang#13077)"
type: learning
topic: slang-compiler
source: learnings/1790377335548-cmake-unquoted-list-expansion-consumes-escapes-ver.md
---

# CMake: unquoted list expansion consumes \; escapes — verify your own arg plumbing before blaming a vendored dep (slang#13077)

---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1789417348054-tyup33
written_at: 2026-09-25T23:02:15.548Z
---

# CMake: unquoted list expansion consumes \; escapes — verify your own arg plumbing before blaming a vendored dep (slang#13077)

**Rule 1 (CMake semantics).** An element escaped with `string(REPLACE ";" "\\;" ...)`, for example a list-valued `-DCMAKE_OSX_ARCHITECTURES=x86_64\;arm64`, keeps its escape through exactly **one** unquoted expansion. If the list is expanded unquoted inside `set(x ... ${list} ...)`, the escape is consumed and the value is re-split. A later `execute_process(COMMAND cmake ${x})` then passes `-DCMAKE_OSX_ARCHITECTURES=x86_64` plus a stray positional `arm64`. The child cmake only warns "Ignoring extra path from command line", and that warning is lost if stderr is printed only on failure.
- Fix: append with a quoted, guarded `list(APPEND x "${list}")` so that the only unquoted expansion is the `execute_process` itself.
- The guard (`NOT list STREQUAL ""`) matters because an empty quoted append adds an empty element and changes the stamp hashes.

**Incident.** shader-slang/slang#13077 (fix PR #13079): macOS universal builds of the vendored DXC failed with `clang-tblgen: Bad CPU type in executable`. The root cause was `cmake/FetchDXC.cmake`. Line 495 escaped the arch list, then line 625 expanded it unquoted inside `set(_dxc_configure_args ...)`. DXC was therefore configured x86_64-only: its tblgen, and also the shipped `libdxcompiler.dylib`. On machines with Rosetta the build succeeds silently with no arm64 slice, so the bug can hide in shipped artifacts.

**Rule 2 (process).** Three fix rounds went after the wrong layer: an unset-arch default, then `LLVM_USE_HOST_TOOLS`, then NATIVE host-tool flags. All of them rested on the theory that the vendored LLVM-3.7 arch detection was at fault. Each round passed a harness that replayed *only the edited block*. The real bug sat downstream in our own arg plumbing, and it surfaced only when a harness replayed the **real consuming code end to end** (FetchDXC.cmake:485-503 and :606-681, verbatim, into a real child cmake, comparing the child's received argv on master vs head).
- Before blaming a third-party build, dump what the child process actually received.
- A harness that re-implements or isolates the changed block proves nothing about the consumer.
- The explicit `-DCMAKE_OSX_ARCHITECTURES=arm64` workaround "working" was the clue: a single arch has no `;` to lose.

**Rule 3 (state).** The issue had been auto-closed by a CI-only PR (#13103, touching only `.github/workflows/*`) whose body said "Fixes #13077", while the bug was still live. When a reporter says "still failing", check the issue state and what they actually built. They may have built master after a false close.

**Validation.** Discriminating check: after a universal build, `lipo -archs` on `libdxcompiler.dylib` must show `x86_64 arm64`, or right after configure, DXC's own `CMakeCache.txt` must contain `CMAKE_OSX_ARCHITECTURES:STRING=x86_64;arm64`. Both fail on master even on runners that have Rosetta. The reporter confirmed the fix on macOS 27 / Xcode 27 hardware on 2026-09-25.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790377335548-cmake-unquoted-list-expansion-consumes-escapes-ver.md`_
