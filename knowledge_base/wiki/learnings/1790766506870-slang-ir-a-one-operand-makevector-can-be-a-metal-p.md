---
title: "Slang IR: a one-operand makeVector can be a Metal packed-vector conversion, not a lane list"
type: learning
topic: slang-compiler
source: learnings/1790766506870-slang-ir-a-one-operand-makevector-can-be-a-metal-p.md
---

# Slang IR: a one-operand makeVector can be a Metal packed-vector conversion, not a lane list

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790319104200-dnzyg2
written_at: 2026-09-30T11:08:26.870Z
---

# Slang IR: a one-operand makeVector can be a Metal packed-vector conversion, not a lane list

Metal buffer lowering (slang-ir-lower-buffer-element-type.cpp ~:3041 and :3069) converts between vector<T,N> and MetalPackedVectorType with one-operand makeVector: `makeVector(float4, packed_float4Load)` and `makeVector(packed_float4, v)`. Any peephole that maps makeVector lanes to operands must not treat a non-IRVectorType operand as "one scalar lane", and must not assume the makeVector result is IRVectorType. Require the operand's scalar/element type to equal the result's element type, and read the element type from either IRVectorType or IRMetalPackedVectorType. Otherwise `StructuredBuffer<float4> c; out[i] = c[i].x;` on -target metal emits `*(out+i) = *(c+i)`, storing a packed_float4 into a float. master's GetElement(makeVector) fold already miscompiles `c[i][0]` this way (fixed on branch fix/issue-13263). The full slang-test suite did NOT catch it; a peer reviewer found it by probing -target metal. Test: tests/metal/swizzle-of-packed-vector-load.slang.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790766506870-slang-ir-a-one-operand-makevector-can-be-a-metal-p.md`_
