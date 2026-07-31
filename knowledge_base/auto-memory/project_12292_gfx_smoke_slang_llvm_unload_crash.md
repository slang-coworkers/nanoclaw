---
name: project_12292_gfx_smoke_slang_llvm_unload_crash
description: "slang#12292 gfx-smoke executes code from unloaded slang-llvm.dll on teardown — PARKED"
metadata: 
  node_type: memory
  type: project
  originSessionId: 54a4144e-e620-42ff-ac25-4e87bcf3723f
---

shader-slang/slang#12292 — `tests/cpu-program/gfx-smoke.slang (cpu)` deterministically crashes at **process teardown** with `0xc0000005` ACCESS_VIOLATION (exit `-1073741819`) AFTER all expected output (`0.0 1.0 2.0 3.0`) prints. Windows Event Viewer names faulting module `slang-llvm.dll_unloaded`; ProcDump: IP inside address range formerly occupied by slang-llvm.dll (in unloaded-module list), active stack in Windows loader/process teardown. Confirmed invariant: an address owned by slang-llvm.dll remains callable after `FreeLibrary`.

**Config-gated:** only reproduces with locally **source-linked** slang-llvm.dll built against official LLVM **21.1.2** Windows dev pkg (`SLANG_SLANG_LLVM_FLAVOR=USE_SYSTEM_LLVM`), Release plugin loaded by Debug binaries. NOT with the fetched plugin. Repro (WSL2): `/mnt/c/bin/slang-test.sh --debug --server-count 0 tests/cpu-program/gfx-smoke.slang`. Not reproducible on Linux.

**Bug/P2. jkwak-work self-filed + self-assigned**, label `Dev Opened`, native Issue Type = Bug. Triager verified @ HEAD `7c58a326b`.

**Root cause (code-grounded hypothesis):** slang-llvm plugin installs process-global LLVM `ManagedStatic`/atexit/`cl::` state (`RegisterCodeGenFlags` builder.cpp:45, `cl::ParseCommandLineOptions` :523, `InitializeAllTargets` :416, `_initLLVM` :480-495), **no `llvm_shutdown()` anywhere** under `source/slang-llvm/`; on Windows `SharedLibrary::unload()` = unconditional `FreeLibrary` (slang-platform.cpp:176-180) with slang-llvm **not** on the unclosable-pin list that protects libdxcompiler/dxvk on POSIX (:237-249) → DLL exit callbacks fire at CRT process-exit after unload.

**Verdict posted** (issue comment 5131917839): A) `llvm_shutdown()` before unload / B) pin the DLL / C) ordering-alone insufficient. jkwak's own note: pinning could *confirm* diagnosis but not final fix until surviving-callback owner + required lifetime understood.

**Sibling of [[project_12283_llvm_jit_coff_ordered_sections_windows]]** (RTDyld COFF section-layout abort). DISTINCT: A/B test rebuilt with custom RuntimeDyld mem-mgr fully disabled → crash persisted identically, so #12292 is independent, occurs with LLVM default `LLJIT`. Distinguished from #12114 (compile-time DIBuilder UAF, MERGED).

**PARKED, NO fixer dispatch.** RESUME = jkwak "make a PR", a linked PR, or a substantive human comment.
