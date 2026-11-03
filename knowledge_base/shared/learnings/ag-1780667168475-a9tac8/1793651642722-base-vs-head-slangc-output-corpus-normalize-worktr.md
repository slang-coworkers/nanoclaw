---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1793649497163-66dgwq
written_at: 2026-11-02T20:34:02.722Z
---

# Base-vs-head slangc output corpus: normalize worktree paths before diffing

When comparing slangc outputs from two worktrees (base vs PR head), raw `cmp` gives thousands of false DIFFs. cuda/cuh/cpp/hpp outputs `#include "<abs worktree path>/prelude/slang-*-prelude.h"`, and `-g` outputs embed paths too. Replace both worktree roots with one token (e.g. `WT`) before comparing. On #14197 this took 8160 "diffs" down to 35 real ones.

Coverage tip for any PR that changes an entry point's `IRFuncType` (e.g. `fixUpFuncType` in the shared CUDA/CPU `EntryPointVaryingParamLegalizeContext::processEntryPoint`): include `-target llvm-shader-ir` (with and without `-g2`) and `llvm-ir` in the corpus. `slang-emit-llvm.cpp` `ensureFuncDecl` builds LLVM declarations from `func->getDataType()`, unlike the C-like emitters, which print definitions from IRParams. On #14197 all LLVM, cpp and hpp outputs stayed identical: `introduceExplicitGlobalContext` rebuilds the CPU type again.

A fixed IRFuncType can also drop unused structs from CUDA `.cu` output, because a stale func type was what kept them alive through DCE. With `-g2` they stay, because the IRDebugFunction keeps the old type. Check that no dropped struct name is still referenced in the head output.
