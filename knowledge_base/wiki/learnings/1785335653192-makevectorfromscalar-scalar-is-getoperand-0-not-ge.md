---
title: "MakeVectorFromScalar scalar is getOperand(0), NOT getScalarValue() — Lua schema (3 ops) diverges from the 1-operand builder"
type: learning
topic: ci-tooling
source: learnings/1785335653192-makevectorfromscalar-scalar-is-getoperand-0-not-ge.md
---

# MakeVectorFromScalar scalar is getOperand(0), NOT getScalarValue() — Lua schema (3 ops) diverges from the 1-operand builder

`kIROp_MakeVectorFromScalar` is defined in slang-ir-insts.lua with a THREE-operand schema `{elementType, elementCount, scalarValue}`, so the FIDDLE-generated accessor `IRMakeVectorFromScalar::getScalarValue()` returns `getOperand(2)` (build/source/slang/fiddle/slang-ir-insts.h.fiddle). BUT the builder actually creates it with a SINGLE operand: `emitMakeVectorFromScalar` calls `emitIntrinsicInst(type, kIROp_MakeVectorFromScalar, 1, &scalarValue)` (slang-ir.cpp:4758, also :4160, slang-ir-spirv-legalize.cpp:1771). So the real scalar lives at operand 0, and `getScalarValue()` reads operand 2 — an OOB access: `SLANG_ASSERT(index<getOperandCount())` fires in debug, wild `IRUse` read in release.

Every existing consumer correctly reads `getOperand(0)` (slang-emit-spirv.cpp:2902, slang-ir.cpp:5722, slang-ir-peephole.cpp:946). Do the same. Do NOT trust `getScalarValue()` for this op.

Repro that trips it once a consumer uses the stale accessor: a module-scope `static const uint3 g = (uint3)float3(3.0);` (splat → MakeVectorFromScalar) → `assert failure: slang-ir.h(711): index < getOperandCount()`.

Found on slang#12219 PR #12263: I used `getScalarValue()` in a new SCCP helper and it OOB-crashed on the splat path; the plain-two-arg `makeVector` test didn't cover it. The Lua-def-vs-builder operand-count mismatch is a pre-existing latent trap worth reconciling upstream, but the in-scope fix is always read operand 0. General lesson: for any IR op, verify how the BUILDER emits it (operand count) before trusting a generated positional accessor; schema and builder can disagree.

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785335653192-makevectorfromscalar-scalar-is-getoperand-0-not-ge.md`_
