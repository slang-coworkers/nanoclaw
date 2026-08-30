---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787691993339-eso1jz
written_at: 2026-08-29T16:04:36.812Z
---

# Unwritten entry-point varying output: the store IS the interface anchor — don't skip it

**slang#12756.** Fixing a spurious store into a never-written varying output (partial-init returned struct): the naive "just skip the store" **breaks the interface**.

**Why:** a varying-output global lands in the SPIR-V `OpEntryPoint` interface ONLY if it's used as an operand reachable from the entry point (`buildEntryPointReferenceGraph`, slang-ir-call-graph.cpp), and it survives DCE only via that use (`keepGlobalParamsAlive` defaults FALSE = `-preserve-params`). The store is the sole anchor. Remove it → the varying vanishes entirely (measured on BOTH SPIR-V and GLSL: no OpEntryPoint entry, no Location, no OpVariable). The CURRENT buggy compiler keeps the varying declared *because* the bad store anchors it. So "declared + no store" is NOT achievable by dropping the store.

**Correct low-risk fix:** keep the store, but substitute a canonical `emitLoadFromUninitializedMemory(fieldType)` for the uninitialized-read value. On SPIR-V at -O1+/default the backend then elides the `OpStore %x %OpUndef` → declared + no store (matches the "Expected Behavior"). At -O0 the undef store remains (benign). GLSL keeps a store of a fresh uninit local.

**DependsOnDecoration is NOT a shortcut here.** DeepWiki claimed `[dependsOn(x)]` keeps an entry-point output in the interface with no store — I built it and it FAILED for SPIR-V: (a) `getFirstChild()` SKIPS decorations, so `buildEntryPointReferenceGraph`'s `getChildren()` walk never sees the decoration; (b) even after teaching the ref-graph + emit-spirv `ensureInst` + `[keepAlive]`, deeper spirv-legalize / translate-global-varying-var passes still prune it. 4 coordinated changes insufficient → disproportionate for a P2. Truly-no-store across all opt levels is a deep SPIR-V-pipeline rework.

**Two instrument traps that caused false-greens:**
1. **slang-test forces `-O0` by default** unless the test names its own `-O` level (`addDefaultSlangOptimization` short-circuits on `hasSlangOptimizationArg`). A store-elision fix only visible at -O1+ needs the test to specify `-O1`.
2. **FileCheck trailing `CHECK-NOT` scoping:** a `CHECK-NOT` after the last positive `CHECK` scans only the tail region. If the forbidden line sits earlier (e.g. the uv store is emitted BETWEEN the color and gl_Position stores), the NOT misses it and the test passes on the BUGGY binary. Bracket the `-NOT` between two ordered positive matches that straddle the offending line. ALWAYS confirm the regression test FAILS on the unfixed binary (copy it into a clean master checkout and run master's slang-test).
