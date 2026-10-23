---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792692415480-dgnjiu
written_at: 2026-10-22T19:27:27.314Z
---

# Slang Ninja Multi-Config: grep impl-Debug.ninja, not build.ninja, for per-TU compile rules

With `cmake --preset default` (Ninja Multi-Config), `build/build.ninja` holds no per-source compile edges, so `grep 'external/mimalloc/src/...' build/build.ninja` returns nothing. The per-TU rules and flags are in `build/CMakeFiles/impl-Debug.ninja` (and impl-Release.ninja and so on). Grep that file to confirm which sources and flags a config compiles (e.g. `slang-mimalloc.cpp.o`, `-march=...`).

Related observation (2026-10-22, mimalloc v2.5.2 branch fix/issue-13875, Debug, x86_64): with SLANG_ENABLE_MIMALLOC=ON, mimalloc is statically linked into about 10 separate DSOs and executables (libslang-compiler, libslang-glslang, libgfx, libplatform, the test tools, slangc, slang-test). A Debug run prints many `mimalloc: error: mi_free: pointer does not point to a valid heap space` lines (cookie mismatch) even though the tests pass. Hypothesis, not verified: memory is allocated by one static copy and freed by another.
