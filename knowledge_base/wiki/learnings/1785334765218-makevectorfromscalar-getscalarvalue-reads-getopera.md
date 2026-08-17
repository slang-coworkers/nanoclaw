---
title: "MakeVectorFromScalar getScalarValue() reads getOperand(2) but builder emits 1 operand"
type: learning
topic: ci-tooling
source: learnings/1785334765218-makevectorfromscalar-getscalarvalue-reads-getopera.md
---

# MakeVectorFromScalar getScalarValue() reads getOperand(2) but builder emits 1 operand

**Trap (confirmed on shader-slang/slang, PR #12263, Jul 2026):** `IRMakeVectorFromScalar`'s Lua schema (`source/slang/slang-ir-insts.lua:1373`) declares **3 operands** `{elementType, elementCount, scalarValue}`, so the FIDDLE-generated accessor is `getScalarValue() { return getOperand(2); }` (`build/source/slang/fiddle/slang-ir-insts.h.fiddle:9349`). **But every builder emits it with exactly 1 operand** — `IRBuilder::emitMakeVectorFromScalar` → `emitIntrinsicInst(type, kIROp_MakeVectorFromScalar, 1, &scalarValue)` (`slang-ir.cpp:4758`; also `slang-ir-spirv-legalize.cpp:1771` with explicit count=1). Every existing consumer reads the scalar via **`getOperand(0)`** (`slang-emit-spirv.cpp:2903`, `slang-ir-peephole.cpp:946`, `slang-ir.cpp`), and nothing in-tree called `getScalarValue()` until #12263 did.

Consequence: calling `splat->getScalarValue()` = `getOperand(2)` on a 1-operand inst trips `SLANG_ASSERT(index < getOperandCount())` (`slang-ir.h:711`) in Debug and reads two `IRUse` slots past the operand array (wild pointer) in Release. Reachable from a module-scope splat cast e.g. `static const uint3 g = (uint3)float3(3.0);`.

**Rule:** to read a `MakeVectorFromScalar` scalar, use `getOperand(0)`, NOT `getScalarValue()`. The Lua-schema-vs-builder operand-count mismatch is a pre-existing latent trap worth filing separately.

**Reviewer lesson (A vs C fiddle availability):** Reviewer A (correctness) flagged this as a 🔴 bug at confidence 90 because its checkout had `build/source/slang/fiddle/` present, letting it read `getScalarValue()`→`getOperand(2)`. Reviewer C (clarity) flagged the *same location* but could only say "please confirm" — its worktree lacked `build/fiddle` so it couldn't resolve the accessor. When adjudicating a reviewer's "cannot confirm from source" finding, check whether the generated fiddle headers exist in your checkout and resolve it yourself — the difference decides bug-vs-nit.

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785334765218-makevectorfromscalar-getscalarvalue-reads-getopera.md`_
