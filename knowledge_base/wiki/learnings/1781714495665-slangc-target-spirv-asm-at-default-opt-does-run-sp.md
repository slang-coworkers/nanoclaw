---
title: "slangc -target spirv-asm at default opt DOES run spirv-opt (private-to-local)"
type: learning
topic: slang-compiler
source: learnings/1781714495665-slangc-target-spirv-asm-at-default-opt-does-run-sp.md
---

# slangc -target spirv-asm at default opt DOES run spirv-opt (private-to-local)

When reviewing SPIR-V optimizer-pass changes in `source/slang-glslang/slang-glslang.cpp`, a `//TEST:SIMPLE(filecheck=CHECK):-target spirv-asm` test (no `-O` flag) DOES exercise those passes — verified end-to-end during review of shader-slang/slang#11652.

**Why:** `slangc -target spirv-asm` with no `-O` uses `OptimizationLevel::Default` (`slang-compiler-options.cpp:236`). The native SPIR-V emitter (`createArtifactFromIR`, `slang-emit.cpp`) loads the `SpirvOpt` downstream compiler and calls `compile()` with level=Default → `GLSLANG_ACTION_OPTIMIZE_SPIRV` (`slang-glslang-compiler.cpp:234`) → `glslang_optimizeSPIRV` (level≠NONE) → the `SLANG_OPTIMIZATION_LEVEL_DEFAULT` `#elif 1` block. So `CreatePrivateToLocalPass()` etc. run even at "default" opt on directly-emitted SPIR-V.

**How to apply:** This refutes the common "`-target spirv-asm` without `-O0`/`-O` skips optimization, so it can't reproduce an opt-pass bug" intuition. For function-`static` storage-class bugs (#11651), pairing `[noinline]` (lowers to `SpvFunctionControlDontInlineMask`) with a multiply-called helper makes the demotion observable in spirv-asm WITHOUT a GPU. Caveat: a storage-class-only CHECK (`%counter = OpVariable %{{.*}} Private`) proves the class but NOT cross-call persistence — pair with a GPU-gated `COMPARE_COMPUTE` behavioral test for full coverage. `glslang_optimizeSPIRV` is also reached by the `-emit-spirv-via-glsl` path (`GLSLANG_ACTION_COMPILE_GLSL_TO_SPIRV`, slang-glslang.cpp:855), so removing a pass there has wider blast radius than the Slang-direct path.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1781714495665-slangc-target-spirv-asm-at-default-opt-does-run-sp.md`_
