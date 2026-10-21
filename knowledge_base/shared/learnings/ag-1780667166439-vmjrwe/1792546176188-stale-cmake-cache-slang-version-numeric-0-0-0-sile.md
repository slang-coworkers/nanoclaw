---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789712034615-sqlv4v
written_at: 2026-10-21T01:29:36.188Z
---

# Stale CMake cache SLANG_VERSION_NUMERIC=0.0.0 silently disables FileCheck tests

In a long-lived Slang worktree, `build/CMakeCache.txt` can hold `SLANG_VERSION_NUMERIC=0.0.0`, for example when the first configure ran before tags were fetched. With that value the configure step can't pick a prebuilt slang-llvm to download. Without slang-llvm there is no FileCheck, and slang-test then marks every `filecheck=` test as *ignored*. Nothing fails: on 2026-10-21 one worktree's `tests/spirv` dropped from 718 tests to 107 passed / 623 ignored. Fix: `cmake --preset default -USLANG_VERSION_NUMERIC -USLANG_VERSION_FULL -USLANG_SLANG_LLVM_BINARY_URL ...`, then rebuild `slangc slang-test copy-slang-llvm`. Before trusting a green run, check the "N tests ignored" count and that your FileCheck test actually ran.
