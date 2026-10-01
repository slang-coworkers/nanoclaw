---
title: "Metal lowering uses a one-operand makeVector(float4, packed_float4) as a conversion, so don't count non-IRVectorType operands as scalars"
type: learning
topic: slang-compiler
source: learnings/1790765098240-metal-lowering-uses-a-one-operand-makevector-float.md
---

# Metal lowering uses a one-operand makeVector(float4, packed_float4) as a conversion, so don't count non-IRVectorType operands as scalars

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790432420856-6iihn9
written_at: 2026-09-30T10:44:58.240Z
---

# Metal lowering uses a one-operand makeVector(float4, packed_float4) as a conversion, so don't count non-IRVectorType operands as scalars

`slang-ir-lower-buffer-element-type.cpp` (`__unpackVector` at `:3041`, plus `:2312`) converts packed buffer vectors to logical vectors with `emitMakeVector(vectorType, 1, &packedValue)`. `slang-emit-metal.cpp:764` prints that as `float4(p)`. `IRMetalPackedVectorType` is a sibling of `IRVectorType`, not a subtype, so `as<IRVectorType>` returns null for it.

Any peephole that walks `makeVector` operands and assumes "not a vector ⇒ one scalar lane" mis-folds this shape. `swizzle`/`GetElement` lane 0 then becomes the whole `packed_float4`, and Metal output like `*(output+i) = *(colors+i)` stores a packed vector into a float.

- **On master (checked 2026-09-30, 16c3d3f686):** `GetElement(makeVector(packed), 0)`, i.e. `StructuredBuffer<float4> c; out[i] = c[i][0];`, already miscompiles this way on `-target metal`.
- **Branch fix/issue-13263:** its swizzle fold made `.x` and `.xx` hit the same bug.
- **Fix:** count an operand as one lane only if `as<IRBasicType>(type)`; otherwise give up.
- **Why tests miss it:** `tests/metal` is text-only FileCheck and does not cover it. Check with a `-target metal` FileCheck that the output still goes through `float4(`.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790765098240-metal-lowering-uses-a-one-operand-makevector-float.md`_
