---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1786623701442-40a5k7
written_at: 2026-08-13T14:27:40.810Z
---

# compile-perf [MEM] protocol is driver-only; target-mode memory attribution is net-new compiler work

Triaging shader-slang/slang#12526 (per-component memory attribution), verified at master ac3617f8c:

- The `[MEM] name\tNNNkb` line protocol is emitted ONLY by the perf harness's own native driver, `tools/compile-perf/native/api-driver.cpp:354` (reportMemDeltas). There is NO `[MEM]` emitter anywhere in `source/`. slangc's `-report-perf-benchmark` (slang-options.cpp:608) emits ONLY `[*]` ms timers + "Type Dictionary Size" (slang-end-to-end-request.cpp:1978). ⇒ target-mode workloads (which go through the slangc CLI, not the dlopen api-driver) have NO memory reporting at all; adding any per-component memory metric for them is net-new compiler-side work, not a tracker change.
- The tracker side IS name-generic: bench.py parse_mem stores arbitrary name→kb gated only on a `Kb` name suffix; trend.judged gates any counter whose unit_of=="kb" (trend.py:50-64). A new named counter needs a producer emit + a `track_memory` manifest flag, NO bench.py/trend/chart change.
- `MemoryArena::calcTotalMemoryUsed()`/`calcTotalMemoryAllocated()` (slang-memory-arena.cpp:459/465) exist with ZERO production call sites (one unit-test caller each). They are the used-vs-reserved primitive any arena-component counter would use.
- Arena block sizes: AST 2 MiB (kASTBuilderMemoryArenaBlockSize), IR 16 KiB (kMemoryArenaBlockSize slang-ir.h:2133). Type layouts are refcounted (class Layout:RefObject), NOT arena-backed, with a documented cyclic-type leak TODO at slang-type-layout.h:1035-1039.
- Each loaded module (incl. DLL-loaded builtins via tryLoadBuiltinModuleFromDLL→loadBuiltinModule) keeps its IR in its OWN IRModule::m_memoryArena and registers in `m_builtinLinkage->mapNameToLoadedModules` (slang-global-session.cpp:718); only `Core` lands in `Session::coreModules` (:508-513). So a walk that sums only `coreModules` misses per-linkage loaded modules — the fix is to iterate `mapNameToLoadedModules` and sum each module's getIRModule() arena, which is DISTINCT from adding the linkage's root ASTBuilder (the latter only covers AST).
- Retained decompressed core-module container: RiffFileSystem:MemoryFileSystem holds the blob in Entry::m_contents inside Dictionary m_entries (slang-memory-file-system.h:121/146), retained for the FS lifetime (filed as #12530).

Method note: `malloc_history -callTree -invert` + `vmmap -summary` (with MallocStackLogging=1) is the macOS way to attribute the unattributed residual to region types; it's macOS-arm64-only, so on Linux you can verify the code-structure mechanisms but not reproduce the byte counts.
