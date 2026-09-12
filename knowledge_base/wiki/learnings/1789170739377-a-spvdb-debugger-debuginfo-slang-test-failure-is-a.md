---
title: "A SPVDB_DEBUGGER/debuginfo slang-test failure is a slangc -g2 SPIR-V opt bug, not a slang-test/spvdb integration bug"
type: learning
topic: slang-compiler
source: learnings/1789170739377-a-spvdb-debugger-debuginfo-slang-test-failure-is-a.md
---

# A SPVDB_DEBUGGER/debuginfo slang-test failure is a slangc -g2 SPIR-V opt bug, not a slang-test/spvdb integration bug

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1789169518968-jb6o3a
written_at: 2026-09-11T23:52:19.377Z
---

# A SPVDB_DEBUGGER/debuginfo slang-test failure is a slangc -g2 SPIR-V opt bug, not a slang-test/spvdb integration bug

Triage of shader-slang/slang#13024 (spvdb `SPVDB_DEBUGGER` intermittently trips SPIRV-Tools `assert(unique_id_ != 0)` at `opt/instruction.h:251` on macOS-aarch64 Debug in the merge queue).

Two non-obvious, verified corrections (a subagent AND DeepWiki got these wrong):

1. **Slang's DEFAULT optimization level is `OptimizationLevel::Default` (O1), NOT `None`/-O0** — `source/slang/slang-compiler-options.cpp:459-460` returns `Default` as the fallback. So a plain `slangc -target spirv -g2` (no `-O`) DOES run the SPIRV-Tools optimizer (`glslang_optimizeSPIRV`, `source/slang-glslang/slang-glslang.cpp:290`, registers `CreateAggressiveDCEPass` etc.). `glslang_optimizeSPIRV` early-returns ONLY at explicit None+no `-Xspirv-opt` (`:285-288`). Empirical proof: default vs `-O0` produce different SPIR-V (5344B vs 5620B). The `slang-emit.cpp:3474` "default -O0" comment is about an EXPLICIT `-O0`, not the unset default. `needsOptimization` gate at `slang-emit.cpp:3531-3538`; opt runs via `compiler->compile()` at `:3643`.

2. **SPVDB_DEBUGGER / debuginfo tests are NOT a slang-test-integration or spvdb-state problem.** libspvdb (`tests/spvdb/lib`) has its OWN SPIR-V IR and does not link/use SPIRV-Tools (0 hits for spvtools/opt::/unique_id). The harness `runSpvdbDebuggerTest` (`tools/slang-test/slang-test-main.cpp:5546,5566-5580`) compiles Step-1 SPIR-V by spawning `slangc` as a **fresh isolated `SpawnType::UseExe` subprocess** — `getFinalSpawnType` leaves UseExe unchanged even under `-use-test-server` (`test-context.cpp:351-367`), so it is exempt from the long-lived test-server/global-state leakage class. A "slangc failed: ... instruction.h ... unique_id" in a debuginfo test means the assert fires inside that single fresh slangc `-g2` compile (SPIRV-Tools ADCE/DefUseManager/DebugInfoManager reading `unique_id()` on an inst never registered with the IRContext), i.e. a latent SPIR-V debug-info emit/opt bug, cf. the earlier SPIRV-Tools DefUse/NonSemantic-debug bug #11146. Under NDEBUG the assert is compiled out → the same latent bug is silent on release/other-platform-debug builds. Don't chase the "stale vendored-tool state in the long-lived slang-test process" hypothesis for these — verify the spawn type and whether opt runs first.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1789170739377-a-spvdb-debugger-debuginfo-slang-test-failure-is-a.md`_
