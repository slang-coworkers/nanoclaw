---
title: "Slang has TWO type-alignment systems: reflection IRTypeLayout vs natural-layout engine"
type: learning
topic: slang-compiler
source: learnings/1785528040007-slang-has-two-type-alignment-systems-reflection-ir.md
---

# Slang has TWO type-alignment systems: reflection IRTypeLayout vs natural-layout engine

When reasoning about type alignment/stride in Slang IR, distinguish two INDEPENDENT systems — conflating them causes wrong-layer fixes:

1. **Reflection `IRTypeLayout`** (subtypes `IRArrayTypeLayout`, `IRParameterGroupTypeLayout`, `IRStructTypeLayout`...). Produced by lowering the AST `TypeLayout` in `_lowerTypeLayoutCommon` (`slang-lower-to-ir.cpp` ~16020). Historically carried ONLY size (`IRTypeSizeAttr`) — the front-end's `TypeLayout::uniformAlignment` (`slang-type-layout.h:767`) and `SequenceTypeLayout::uniformStride` were DROPPED at the AST→IR boundary. (PR #11135's `IRTypeAlignmentAttr` work fixes this — adds alignment attr generation here.) Consumers: the ~18 `findSizeAttr`/`getSizeAttrs` sites (`slang-ir-metadata.cpp`, `slang-ir-entry-point-uniforms.cpp`, `slang-reflection-json.cpp`, `slang-ir-glsl-legalize.cpp`).

2. **Natural-layout engine** (`slang-ir-layout.cpp`): `getSizeAndAlignment(target, IRTypeLayoutRules*, type, &out)` computes size AND alignment on demand from the RAW IR TYPE + an explicit layout-rules object (`Std140`/`Std430`/`Natural`/`ConstantBuffer`/`C`/`CUDA`/`LLVM`), caching on an `IRSizeAndAlignmentDecoration` attached to the TYPE (not the layout). SPIR-V stride/offset emission uses THIS: `getArrayElementStrideValue`/`getPointerArrayStrideValue`/matrix stride/member `getOffset` in `slang-emit-spirv.cpp` (~1997/2016/7028). It NEVER reads reflection `IRTypeLayout`.

KEY IMPLICATION: "SPIR-V divines alignment because IR type layouts lack it" is a natural assumption but WRONG — SPIR-V uses system #2, which already has alignment. Adding an alignment attr to reflection layouts (#1) does NOT change SPIR-V emission. Verified at HEAD c3791ed4ee (2026-07).

Also: `-dump-ir` DOES print reflection layout attrs (e.g. `size(8 : Int, 32 : Int)` where 8=LayoutResourceKind::Uniform; `arrayTypeLayout(...)`, `offset(...)`) — mnemonic = the lua KEY in `slang-ir-insts.lua` (not struct_name). So a new layout attr op is FileCheck-testable via `-dump-ir -o /dev/null` against the combined stdout+stderr a SIMPLE(filecheck=) test captures.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1785528040007-slang-has-two-type-alignment-systems-reflection-ir.md`_
