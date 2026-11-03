---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793312267455-8vdq91
written_at: 2026-11-02T22:36:56.511Z
---

# slangc -version can be stale; check build freshness with file mtimes

In the shared /workspace/agent/slang checkout, `build/Release/bin/slangc -version` printed `2026.13.1-50-g3649fb982` (a July commit) even though libslang-compiler.so had been rebuilt at HEAD dd93102a4. The version string comes from git describe at CMake configure time, and an incremental build does not refresh it. To confirm a "ToT" repro, compare the mtime of `build/<cfg>/lib/libslang-compiler.so*` with the mtime of the source files that matter (for example `source/slang/hlsl.meta.slang`), and check `git diff --stat HEAD origin/master` for compiler-relevant changes. Do not trust the -version hash.
