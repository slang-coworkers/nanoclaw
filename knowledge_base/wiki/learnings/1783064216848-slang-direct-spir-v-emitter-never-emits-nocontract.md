---
title: "Slang direct SPIR-V emitter never emits NoContraction — fp-mode/precise are no-ops there"
type: learning
topic: slang-compiler
source: learnings/1783064216848-slang-direct-spir-v-emitter-never-emits-nocontract.md
---

# Slang direct SPIR-V emitter never emits NoContraction — fp-mode/precise are no-ops there

**Finding (slang #11933, verified at HEAD f4975a7f8):** Slang's *direct* SPIR-V backend (`source/slang/slang-emit-spirv.cpp`) never emits the `NoContraction` decoration — the string `NoContraction` appears **nowhere** in Slang's own source (only in bundled `external/glslang`). So `-fp-mode precise` and the `precise` declaration modifier are both silent no-ops on `-target spirv`, even though glslang, DXC, and Slang's own legacy `-emit-spirv-via-glsl` all emit it.

**Why (three independent controls, all dropped by direct SPIR-V emit):**
1. Global `-fp-mode` (`FloatingPointMode` option) is plumbed **only** to downstream compilers at `slang-code-gen.cpp:820-829` (DXC/glslang/fxc/nvrtc) — that's why `-emit-spirv-via-glsl` honors it. The direct emitter never reads the mode. It's also used by the peephole optimizer to gate fast-math folding (`slang-ir-peephole.cpp:20,169`).
2. The `precise` modifier lowers to `IRPreciseDecoration` (`slang-lower-to-ir.cpp:3115`) but is consumed **only** by the textual C-like emitter (`slang-emit-c-like.cpp:1691` fold-guard, `:4633` emits the `precise ` keyword). The SPIR-V decoration dispatcher `emitDecoration()` at `slang-emit-spirv.cpp:6003` has `default: break;` with no case for it → silently dropped.
3. `IRFloatingPointModeOverrideDecoration` (per-function fp-mode, `slang-ir-insts.h:771`) is read **only** by peephole, not by SPIR-V emit.

**Fix direction:** emit `OpDecorate <result> NoContraction` on FP arithmetic in the SPIR-V emitter when effective fp-mode is precise (float arith at `slang-emit-spirv.cpp:839`/`:847`; per-value hook `emitDecorations()` at `:5646`; mode via `m_targetProgram->getOptionSet().getFloatingPointMode()`), and add the missing `case kIROp_PreciseDecoration:` at `:6003`. Full glslang-style backward propagation of the per-decl modifier is a follow-up.

**GPU-free verification method (reusable):** compile with `LD_LIBRARY_PATH=build/Release/lib slangc repro.slang -target spirv -fp-mode <m> -O0 -o m.spv` for m in precise/fast/default, then `md5sum` them (identical = no-op) and parse the binary for OpDecorate (opcode 71) operand 42 (NoContraction) in Python. `-target spirv-asm` needs the `spirv-dis` downstream lib which isn't in this Release build, so parse the raw binary instead. No GPU required — it's a compile-time decoration bug.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783064216848-slang-direct-spir-v-emitter-never-emits-nocontract.md`_
