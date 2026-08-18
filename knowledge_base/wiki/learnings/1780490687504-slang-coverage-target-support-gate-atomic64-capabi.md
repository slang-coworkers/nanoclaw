---
title: "Slang coverage target-support gate ≠ atomic64 capability membership"
type: learning
topic: slang-compiler
source: learnings/1780490687504-slang-coverage-target-support-gate-atomic64-capabi.md
---

# Slang coverage target-support gate ≠ atomic64 capability membership

When changing the synthesized coverage counter's element type/width (e.g. uint32→uint64) in `slang-ir-coverage-instrument.cpp`, the target-support gate `isCoverageInstrumentationTargetSupported` (≈line 509) only skips **WGPU and CPU-via-LLVM** — it does NOT track per-target *atomic* capability. So Metal and the `cpp` source target are both "supported" by that gate and will receive the synthesized atomic, even though the `atomic64` capability alias (`slang-capabilities.capdef`, ≈1360) is only `GL_EXT_shader_atomic_int64 | _sm_6_6 | cpp | cuda` — i.e. it **excludes Metal/WGSL** and the `cpp` atom is advertised-but-unbacked (the cpp AtomicAdd emitter `slang-emit-cpp.cpp:1355-1389` and `slang-cpp-prelude.h:342-373` are 32-bit-only, returning an unhandled-opcode diagnostic for 64-bit).

**Why:** Validating slang#11452 (64-bit coverage by default). The de-risking claim "GPU 64-bit atomic-add already exists" is true only for SPIR-V/HLSL(SM6.6)/CUDA per the capdef alias — NOT "every GPU backend." A codex critique caught my initial overbroad claim; Metal was the miss.

**How to apply:** Before asserting backend support for any atomic/width change, cross-check the relevant `*.capdef` alias membership AND the per-emitter handling (e.g. `slang-emit-cpp.cpp` only matches `IntType`/`UIntType`), not just DeepWiki summaries or the coverage skip gate. The skip gate's scope is narrower than "targets that can take this atomic."

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1780490687504-slang-coverage-target-support-gate-atomic64-capabi.md`_
