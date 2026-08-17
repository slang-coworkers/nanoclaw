---
title: "SCCP: marking non-IRConstant aggregates as Constant(inst) breaks the pass-wide IRConstant invariant"
type: learning
topic: agent-ops
source: learnings/1785338682203-sccp-marking-non-irconstant-aggregates-as-constant.md
---

# SCCP: marking non-IRConstant aggregates as Constant(inst) breaks the pass-wide IRConstant invariant

**Bug pattern (shader-slang/slang #12263 R2, Jul 2026):** When teaching global-scope SCCP to fold aggregate constructors, it's tempting to mark `MakeVector`/`MakeVectorFromScalar` as `LatticeVal::getConstant(inst)` — i.e. "constant as itself" (the vector has no `IRConstant` form). **This silently breaks a pass-wide invariant:** every scalar evaluator in `slang-ir-sccp.cpp` (`evalCast`, `evalBitCast`, `evalNeg`, `evalSelect`, `evalBinaryImpl`, …) does `auto c0 = as<IRConstant>(v0.value);` and then **dereferences `c0` WITHOUT a null check**. Once a `Constant` lattice value can wrap a non-`IRConstant` inst, any of those evaluators that receives it null-derefs → compiler crash.

**Concrete reachable crash:** `bit_cast` is the op that takes a **vector operand → scalar result**, so it's NOT caught by a vector-result fold path; it passes the scalar-result gate (`if (!as<IRBasicType>(...)) return Any` — result is scalar) and reaches `evalBitCast` at ~line 1186 with `v0 = Constant(makeVector)` → `as<IRConstant>` returns null → `c0->getDataType()` crashes. Repro: `static const uint u = bit_cast<uint>(uint16_t2(1,2));` (valid Slang — `bit_cast<T,U>` allows any same-size scalar/vector/matrix; both operands constant → makeVector marked Constant(self)). Crashes at global scope AND per-function fixpoint (member `isEvaluableOpCode` gates both).

**Principled fix:** don't just guard the one consumer that broke. Document at `LatticeVal::getConstant` that a `Constant` value may now be a self-referential aggregate, and guard-or-assert-scalar EVERY `as<IRConstant>(v0.value)` site. Add a `bit_cast<scalar>(constVector)` regression test — the vector-result tests don't exercise the vector-operand→scalar-result path.

**Reviewer lesson:** a fix that adds a new *kind* of lattice/IR value must audit the invariant's full blast radius (all consumers), not just the changed lines. R1→R2 delta-diffing the changed hunks MISSED this; the finding required tracing what the invariant break exposes. Devin under-ranked it (Informational "monotonicity" note); clarity touched it obliquely. Correctness Reviewer A's whole-invariant trace caught it.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785338682203-sccp-marking-non-irconstant-aggregates-as-constant.md`_
