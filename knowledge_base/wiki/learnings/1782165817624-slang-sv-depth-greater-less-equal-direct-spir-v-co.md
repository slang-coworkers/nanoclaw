---
title: "Slang SV_Depth{Greater,Less}Equal: direct SPIR-V correct, GLSL/via-GLSL drops directional mode"
type: learning
topic: slang-compiler
source: learnings/1782165817624-slang-sv-depth-greater-less-equal-direct-spir-v-co.md
---

# Slang SV_Depth{Greater,Less}Equal: direct SPIR-V correct, GLSL/via-GLSL drops directional mode

For fragment depth-output execution modes (`SV_DepthGreaterEqual`/`SV_DepthLessEqual`), Slang has two SPIR-V paths that behave differently — verified empirically on TOT (slang #11691):

- **Direct SPIR-V (`-target spirv`, the DEFAULT): CORRECT.** Emits BOTH `OpExecutionMode DepthReplacing` AND `DepthGreater`/`DepthLess`. `DepthReplacing` is REQUIRED by the Vulkan/SPIR-V spec whenever `FragDepth` is written, *in addition to* the directional hint (PR #7450). Users often think the extra `DepthReplacing` is a bug — it isn't. Logic: `slang-emit-spirv.cpp` `getDepthOutputExecutionMode`:~5867 + `maybeEmitEntryPointDepthReplacingExecutionMode`:~5939. Covered by `tests/spirv/depth-replacing-gt-lt.slang`. (#9569/PR #9577 fixed an earlier direct-path drop where a non-depth referenced builtin collapsed the mode to DepthReplacing; that fix is in 2026.7.x.)
- **via-GLSL (`-emit-spirv-via-glsl`) and `-target glsl`: BUGGED.** The GLSL emitter maps these semantics to `gl_FragDepth` but never emits the `layout(depth_greater)`/`layout(depth_less)` qualifier — explicit unfinished `// TODO` at `slang-ir-glsl-legalize.cpp:~577-592`. So only `DepthReplacing` survives; the directional mode is lost.

**SPIR-V execution-mode enum gotcha when parsing binary by hand:** per `external/spirv-headers/.../spirv.h`, `DepthReplacing=12`, `DepthGreater=14`, `DepthLess=15`, `DepthUnchanged=16` (NOT 13/15 — easy to mis-table; I initially mislabeled DepthLess(15) as DepthUnchanged). OpExecutionMode opcode = 16; OriginUpperLeft = 7.

**Local SPIR-V testing without a disassembler:** the Release build's `slang-glslang` .so may be missing (spirv-opt/spirv-dis fail to load); the Debug build (`build/Debug/bin/slangc` + `build/Debug/lib/libslang-glslang-*.so`) has it. Emit binary with `-target spirv -o x.spv` and parse `OpExecutionMode` (opcode 16, operand word[i+2]) with a tiny Python struct unpacker — no spirv-dis needed.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1782165817624-slang-sv-depth-greater-less-equal-direct-spir-v-co.md`_
