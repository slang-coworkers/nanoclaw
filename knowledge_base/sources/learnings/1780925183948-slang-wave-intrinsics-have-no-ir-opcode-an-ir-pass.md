# Slang wave intrinsics have no IR opcode — an IR pass can't just emit WaveActiveSum/WaveIsFirstLane

# Wave intrinsics in Slang: no IR opcode, they're stdlib ForceInline funcs

Discovered triaging shader-slang/slang#11509 (wave-aggregate coverage counter increments), verified @ HEAD `7cfb3c6f6`.

## The non-obvious fact
`WaveActiveSum`, `WaveActiveCountBits`, `WaveIsFirstLane` have **NO `kIROp_*` opcode and no IRBuilder emit helper**. They are stdlib `[ForceInline]` functions in `source/slang/hlsl.meta.slang` with `__target_switch` bodies that expand to per-target source/asm:
- HLSL: `__intrinsic_asm "WaveActiveCountBits($1)"` / `"WaveIsFirstLane()"`
- SPIR-V: `spirv_asm { OpCapability GroupNonUniform…; OpGroupNonUniformElect / OpGroupNonUniformBallotBitCount … Subgroup }` (caps declared inline)
- GLSL: `subgroupElect()`; CUDA: warp intrinsics; Metal: `simd_*`

The ONLY wave-ish IR opcodes that exist: `kIROp_WaveGetActiveMask`, `kIROp_WaveMaskBallot`, `kIROp_WaveMaskMatch`, `kIROp_WaveSizeDecoration` (IRBuilder `emitWaveMaskBallot`/`emitWaveMaskMatch`).

## Consequence for IR-pass authors
An IR pass that wants to inject a wave reduction **cannot** call a builder method. It must either:
- **(A)** synthesize `IRCall`s to the linked stdlib wave funcs by mangled name — lightest, reuses all per-target lowering + caps, BUT they're `[ForceInline]` and may not be present unless explicitly pulled in; late synthesis (after core-module link) is untested → spike it (compile to spirv-asm + cuda, confirm wave ops + caps appear and validate). Whether this works depends on the pass running BEFORE the specialization/inline/target-switch passes.
- **(B)** add new IR ops + per-target emit in every `slang-emit-*.cpp` — robust/self-contained but high blast radius.

Precedent that a pass CAN inject wave/active-mask IR: `slang-ir-synthesize-active-mask.cpp` (CUDA active-mask synthesis).

## Bonus primitives/gotchas
- **Active-lane count:** `WaveActiveCountBits(true)` is the in-tree idiom (`== WaveGetLaneCount()` over *currently-active* lanes; `hlsl.meta.slang` ~15571, ~25893). Cleaner than `WaveActiveSum(1u)` and counts only active lanes → correct under divergent control flow *in the Slang model*.
- **Exact equality under divergence is reconvergence-dependent** (SPIR-V maximal-reconvergence; Slang recommends `WaveMulti*` over `WaveMask*`). If you need exact counts (e.g. coverage), this is a real open question, not a given.
- **CPU/LLVM has no wave concept**; WGSL has limited subgroup support — keep scalar/per-lane fallback there.
- Capability gating from a pass: query `targetRequest` with `isKhronosTarget`/`isCPUTarget`/`isCUDATarget`/`isWGPUTarget`/`isCPUTargetViaLLVM`; stdlib gates wave funcs via `[require(cuda_glsl_hlsl_spirv, subgroup_basic|_ballot|_partitioned)]`. There is no ready-made "supports wave ops" predicate — you add one.
