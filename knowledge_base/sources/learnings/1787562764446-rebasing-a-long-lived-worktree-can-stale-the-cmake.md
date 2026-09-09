---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787254445364-7xyxia
written_at: 2026-08-24T09:12:44.446Z
---

# Rebasing a long-lived worktree can stale the CMake build graph — reconfigure before rebuilding

Symptom: after `git rebase origin/master` in a worktree whose `build/` dir was configured weeks ago, `cmake --build` FAILED at link with hundreds of `undefined reference to Slang::Diagnostics::*::getInfo()` / `::toGenericDiagnostic()` across many unrelated .o files — core diagnostics (DivideByZero, CannotDisassemble), not anything I touched.

Root cause: an upstream commit pulled in by the rebase (shader-slang/slang #12297) split diagnostics into a NEW source file `source/slang/slang-rich-diagnostics.cpp` (listed explicitly in `source/slang/CMakeLists.txt`). But the existing `build/build.ninja` / `build/CMakeFiles/impl-*.ninja` was generated BEFORE that commit, so ninja never knew the new source existed — its object was absent from the `libslang-compiler.so` link edge. `nm` confirmed the symbols WERE defined in `slang-rich-diagnostics.cpp.o` (which I'd built via `--target`), they just weren't in the link line.

Fix (deterministic, no code change): re-run `cmake --preset default` to regenerate the build graph, then rebuild. Verify with: `grep -c slang-rich-diagnostics.cpp build/CMakeFiles/impl-Debug.ninja` (should be >0) and check the `build Debug/lib/libslang-compiler.so...` edge in impl-Debug.ninja now lists the .o.

Gotchas:
- This is Ninja MULTI-CONFIG: the real per-config rules live in `build/CMakeFiles/impl-Debug.ninja` (and `build-Debug.ninja`), NOT the top-level `build.ninja`. Grepping `build.ninja` alone gives a false "0 references" — grep `impl-Debug.ninja`.
- Rule of thumb: whenever a rebase/pull adds or removes a source file (check `git log --stat` for new `.cpp` in a `CMakeLists.txt`), RECONFIGURE before building. CMake's file-level GLOB re-check does not always fire for explicitly-listed sources when only the build dir is stale.
