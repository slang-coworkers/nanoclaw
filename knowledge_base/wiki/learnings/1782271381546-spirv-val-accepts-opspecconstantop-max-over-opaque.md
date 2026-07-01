---
title: "spirv-val accepts OpSpecConstantOp(max) over opaque OpConstantSizeOfEXT as an ArrayStrideIdEXT id"
type: learning
topic: slang-compiler
source: learnings/1782271381546-spirv-val-accepts-opspecconstantop-max-over-opaque.md
---

# spirv-val accepts OpSpecConstantOp(max) over opaque OpConstantSizeOfEXT as an ArrayStrideIdEXT id

**Context:** slang#11718 (unified descriptor-heap stride). Question (Q1): can Slang emit a *symbolic* per-type-max descriptor-heap stride — `max(OpConstantSizeOfEXT(bufferDesc), OpConstantSizeOfEXT(imageDesc))` — as the id operand of `OpDecorateArrayStrideIdEXT`, and will it pass SPIR-V validation? Or is a host-pinned literal stride the only path?

**Answer: YES, it is statically valid.** Resolve such questions against the spirv-tools validator **Slang bundles** at `external/spirv-tools/source/` — this is the exact code that runs under `SLANG_RUN_SPIRV_VALIDATION=1`, and a *better* source of truth than a (likely-outdated) system `spirv-val` binary that won't even know `SPV_EXT_descriptor_heap` opcodes. Key line refs (HEAD ~2026-06):

- **`opcode.cpp:133 spvOpcodeIsConstant`** — returns true for BOTH `OpSpecConstantOp` AND `OpConstantSizeOfEXT` (opcode 5129, grammar class "Constant-Creation"). So `OpConstantSizeOfEXT` is a valid constant operand of `OpSpecConstantOp`, and an `OpSpecConstantOp` result is itself a constant.
- **`val/validate_constants.cpp:590 ValidateSpecConstantOp`** — only Kernel-gates the convert / float / access-chain / bitcast ops; integer `OpSelect` + comparisons (`OpUGreaterThan`, `OpIEqual`, …) fall to `default: break → SPV_SUCCESS` under `Shader`. (There's a `TODO(dneto)` noting it doesn't even type-check the args.) So `max(a,b) = OpSpecConstantOp Select(UGreaterThan(a,b), a, b)` is permitted. NOTE: `OpExtInst GLSL.std.450 UMax` is INELIGIBLE — `OpExtInst` is not in the OpSpecConstantOp opcode set, and its result is not a constant so it can't be a decoration id.
- **`val/validate_annotation.cpp:362-395`** (ArrayStrideIdEXT) — requires only that the stride operand's RESULT TYPE be a 32-bit int scalar (`IsIntScalarType(...,32)`), the target be an array of a descriptor type, and stride≠0. Critically at `:378`: *"Even if spec constant, validation layers will test when frozen"* — when `EvalConstantValUint64` can't fold the id (spec constant OR opaque `OpConstantSizeOfEXT` OR an `OpSpecConstantOp` over them), it SKIPS the zero-check and passes. Non-foldable/deferred stride ids are explicitly tolerated.

**Practical upshot for a "unified/portable descriptor-heap stride":** three portable options, not just literal-vs-nothing — (a) host-pinned literal `-spirv-resource-heap-stride N` (baked at compile time); (b) symbolic max via `OpSpecConstantOp` Select over `OpConstantSizeOfEXT` (driver resolves real sizes at freeze; no host plumbing); (c) a `SpecId` spec-constant the app fills from device properties via `VkSpecializationInfo`. All three hit the same validator path.

**Caveat (carry it):** the bundled validator confirms STATIC validity only; it defers the frozen-value check to the runtime ("validation layers will test when frozen"). A live Vulkan driver is the final arbiter — confirm on-device before shipping a symbolic-stride default. (Slang's existing `stride==0` auto path already emits `OpConstantSizeOfEXT → OpDecorateArrayStrideIdEXT` at `slang-emit-spirv.cpp:7199-7217`; the unified-max just wraps the size-of in an OpSpecConstantOp max.)

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1782271381546-spirv-val-accepts-opspecconstantop-max-over-opaque.md`_
