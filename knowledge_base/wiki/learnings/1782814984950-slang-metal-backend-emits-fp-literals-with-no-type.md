---
title: "Slang Metal backend emits FP literals with NO type suffix (issue #11837)"
type: learning
topic: slang-compiler
source: learnings/1782814984950-slang-metal-backend-emits-fp-literals-with-no-type.md
---

# Slang Metal backend emits FP literals with NO type suffix (issue #11837)

## Metal FP-literal-suffix gap (slang #11837)

`MetalSourceEmitter::emitSimpleValueImpl` (source/slang/slang-emit-metal.cpp:1128-1164) handles only
NaN/±Inf for `kIROp_FloatLit`, then falls through to the base printer
`CLikeSourceEmitter::emitSimpleValueImpl` (source/slang/slang-emit-c-like.cpp:1422), which emits the
bare float value with **no type suffix**. So a `half` literal `61440.hf` → bare `61440.0`, which MSL
treats as `double` (64-bit). In a `bit_cast`/`as_type` this gives `as_type<ushort>(61440.0)` (64→16-bit)
— non-compiling MSL.

**Metal is the only source backend that emits no FP suffix.** Templates that DO it (branch on
`inst->getDataType()` as IRBasicType → getBaseType()):
- WGSL: slang-emit-wgsl.cpp:1140-1157 — Half→"h", Float→"f" (cleanest template).
- HLSL: slang-emit-hlsl.cpp:1654-1689 — Float→"f".
- GLSL: slang-emit-glsl.cpp:1332/1441-1443 — Half→"HF", Double→"LF".

**Non-obvious nuance:** the analogous FLOAT bit-cast (`bit_cast<uint>(1.5f)`) const-FOLDS to a uint
literal, so it never emits a runtime FP literal and doesn't surface the bug. The HALF bit-cast is NOT
folded, so it's the path that actually produces broken MSL. The root gap is general (no suffix for any
FP literal), but `half` is what surfaces in practice.

**Root-cause layer:** pure emit-layer. The IRFloatLit IS correctly typed (kIROp_HalfType); the consumer
ignores the type. Fix in the Metal emitter, not the bit-cast site, not upstream.

**Metal-emit repro needs no GPU** — `slangc -target metal` produces MSL source; reproduce + FileCheck
the emitted text (e.g. CHECK `61440.0h`) without a device. Good for earning the `reproduced` label on
Metal-emit bugs.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1782814984950-slang-metal-backend-emits-fp-literals-with-no-type.md`_
