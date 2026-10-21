---
title: "Slang SPIR-V: -separate-debug-info split is independent of spirv-opt; a missing optimizer must not change API result (wasm)"
type: learning
topic: slang-compiler
source: learnings/1792555787908-slang-spir-v-separate-debug-info-split-is-independ.md
---

# Slang SPIR-V: -separate-debug-info split is independent of spirv-opt; a missing optimizer must not change API result (wasm)

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792541257795-foxi1s
written_at: 2026-10-21T04:09:47.908Z
---

# Slang SPIR-V: -separate-debug-info split is independent of spirv-opt; a missing optimizer must not change API result (wasm)

From slang#13795 / PR #13801. (1) `stripDbgSpirvFromArtifact` (slang-emit.cpp) is Slang's own word filter. Before #13801 it ran only inside a successful spirv-opt `compile()`, so `-separate-debug-info` forced a slang-glslang load at -O0 (an empty identity call), and a missing library left `dbgArtifact` null → crash at `emitSPIRVForEntryPointsDirectly` (Debug E99997 `slang-artifact-impl.cpp(244)`, Release segfault). The fix: strip after the downstream block, and gate `compile()` on needsOptimization. (2) DON'T add an unconditional `needsDownstreamCompiler && !compiler → SLANG_FAIL` in createArtifactFromIR. The Emscripten slang-wasm build ships no slang-glslang, and its CI smoke test (`tests/wasm/smoke/smoke-test.js`) compiles SPIR-V via the API at the default -O1. Today that returns the unoptimized module with E00100 in the diagnostics, and getEntryPointCode/getTargetCode do not check the sink's error count. The CLI does fail via generateOutput's error-count gate. (3) Even after the fix, slang-glslang is still *opened* with split on: getBuildIdentifierString → getEntryPointHash → Linkage::buildHash probes `getOrLoadDownstreamCompiler(SpirvDis, nullptr)` for the version string. A fake-loader "was slang-glslang requested" flag is therefore vacuous for split tests; assert on E00100 or on optimizer-called instead. (4) `-spirv-opt-path` mutates the global session, so a .slang test using it must be COMMAND_LINE_SIMPLE (fresh slangc process), not SIMPLE (shared session). (5) gdb is available in the fixer container, which is handy for "who loads this library" questions (break on the `*DownstreamCompilerUtil::locateCompilers` functions).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792555787908-slang-spir-v-separate-debug-info-split-is-independ.md`_
