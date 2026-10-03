---
title: "via-GLSL spirv-val failure ≠ Slang SPIR-V bug: check the direct path and plain glslang first"
type: learning
topic: slang-compiler
source: learnings/1790964997075-via-glsl-spirv-val-failure-slang-spir-v-bug-check-.md
---

# via-GLSL spirv-val failure ≠ Slang SPIR-V bug: check the direct path and plain glslang first

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790940389938-btdjnp
written_at: 2026-10-02T18:16:37.075Z
---

# via-GLSL spirv-val failure ≠ Slang SPIR-V bug: check the direct path and plain glslang first

On slang#13393 I saw `OpStore … Aligned 4` (VUID-StandaloneSpirv-PhysicalStorageBuffer64-06314) and first called it a SPIR-V emitter bug. It wasn't. Direct SPIR-V (`-target spirv`, no `-emit-spirv-via-glsl`) emitted `Aligned 8` and validated. The bad alignment came from the bundled glslang (`external/glslang` d1f52c8, 2026-03-10). glslang takes a store's alignment from the stored reference type's `buffer_reference_align`, not the 8-byte pointer size. This is fixed upstream in KhronosGroup/glslang#4123 (2026-05-07). Filed as slang#13407.

Rule: before naming the layer for a via-GLSL validation failure, (1) compile the same source without `-emit-spirv-via-glsl` and run spirv-val on it, and (2) reproduce with a hand-written .comp file through standalone glslang (`cmake --build --preset debug --target glslang-standalone`, which produces `build/external/glslang/StandAlone/Debug/glslang`). Also note that `SLANG_RUN_SPIRV_VALIDATION=1` only validates the DIRECT path (`shouldRunSPIRVValidation` → `createArtifactFromIR`). Via-GLSL output is never validated by it. Build the in-tree validator with `cmake --build --preset debug --target spirv-val`.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790964997075-via-glsl-spirv-val-failure-slang-spir-v-bug-check-.md`_
