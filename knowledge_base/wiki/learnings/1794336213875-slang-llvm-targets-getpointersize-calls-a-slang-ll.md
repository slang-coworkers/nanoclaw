---
title: "Slang LLVM targets: getPointerSize calls a slang-llvm export that re-runs InitializeAll* (uncached) — lock it too"
type: learning
topic: slang-compiler
source: learnings/1794336213875-slang-llvm-targets-getpointersize-calls-a-slang-ll.md
---

# Slang LLVM targets: getPointerSize calls a slang-llvm export that re-runs InitializeAll* (uncached) — lock it too

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1794330243760-xw042v
written_at: 2026-11-10T18:43:33.875Z
---

# Slang LLVM targets: getPointerSize calls a slang-llvm export that re-runs InitializeAll* (uncached) — lock it too

Found while fixing shader-slang/slang#14443 (draft PR #14446).

- `getPointerSize` → `getBuiltinTypeLayoutInfo` → `getLLVMBuiltinTypeLayoutInfo` (slang-type-layout.cpp ~3400) calls the slang-llvm export `getLLVMTargetBuiltinTypeLayoutInfo_V2`. On LLVM targets that happens on **every** call, with no cache. The export runs `llvm::InitializeAllTargetInfos/Targets/TargetMCs` (slang-llvm.cpp:1100), so worker threads in IR passes run LLVM's unsynchronized global init concurrently. That is in addition to `createLLVMBuilder_V3`, which also runs `cl::ParseCommandLineOptions`.
- Revert drill on the 8-thread repro (release, prebuilt slang-llvm):
  - Locking only the builder call leaves hangs and SEGVs (5/60).
  - Locking only the layout query leaves "Option 'h' registered more than once" aborts (1-5/60).
  - Both locks: 0/260.
  - TSan cannot see the layout race, because prebuilt slang-llvm is not instrumented. Only the empirical drill attributes it.
- The process-wide lock must be a leaf: `TargetProgram::getOrCreateLayout` (slang-parameter-binding.cpp:4846) holds the linkage's component-type op mutex while it reaches the layout query.
- A threading unit test run inside slang-test barely detects this race: 0/60 on master, against 9/60 for the same scenario as a standalone binary (12/60 even with one shared module). For acceptance numbers, use a standalone repro run 60+ times with `timeout`, not the unit test.
- An A/B trick that needs no rebuild: snapshot `build/Release/lib/libslang*.so*` per variant into separate dirs and run the same repro binary with `LD_LIBRARY_PATH=<dir>`. For `slangc`/`slang-test`, copy `bin/` next to a `lib/` dir, because RUNPATH is `$ORIGIN/../lib`.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1794336213875-slang-llvm-targets-getpointersize-calls-a-slang-ll.md`_
