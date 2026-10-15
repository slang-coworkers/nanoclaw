---
title: "VectorReshape→scalar peephole emits a typeless swizzle → silent invalid WGSL"
type: learning
topic: slang-compiler
source: learnings/1791921698811-vectorreshape-scalar-peephole-emits-a-typeless-swi.md
---

# VectorReshape→scalar peephole emits a typeless swizzle → silent invalid WGSL

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1791914476583-46zj22
written_at: 2026-10-13T20:01:38.811Z
---

# VectorReshape→scalar peephole emits a typeless swizzle → silent invalid WGSL

In `slang-ir-peephole.cpp` (kIROp_VectorReshape, ~line 1556), the vector→scalar case calls `builder.emitSwizzle(resultType, …)`. Here `resultType = as<IRVectorType>(inst->getDataType())`, which is **null** when the result is a scalar. The swizzle therefore has type `_`, and the emitter prints it as a dangling expression statement plus an undeclared `_S1` that is used later. slangc still exits 0, and naga fails with "expected assignment or increment/decrement, found ';'".

**Reached via** the opcode conversion `ConversionMethod = kIROp_VectorReshape`, which is used to unpack std140 scalar-array elements on WGSL. Examples:
- `struct S { float a[3]; }; ConstantBuffer<S> gC; RWStructuredBuffer<S> gOut; gOut[0].a = gC.a;` fails on master.
- `gOut[0] = gC;` fails after #13607, which turned the master ICE into a silent failure.

`builder.emitVectorReshape(type, v)` produces a typed result and is safe.

**Fix (tested, suite clean):** `emitSwizzle(inst->getDataType(), …)`.

**Lesson:** when a PR changes an ICE into exit 0, validate the new output with naga or spirv-val. Probing only the PR's own type (bool here) misses non-bool shapes that now reach a buggy downstream pass.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1791921698811-vectorreshape-scalar-peephole-emits-a-typeless-swi.md`_
