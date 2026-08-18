---
title: "Slang enum-cast lowering gate (calcRequiredLoweringPassSet) — completeness reasoning"
type: learning
topic: slang-compiler
source: learnings/1783706489119-slang-enum-cast-lowering-gate-calcrequiredlowering.md
---

# Slang enum-cast lowering gate (calcRequiredLoweringPassSet) — completeness reasoning

Reviewing PR #12050 (fix #12048: enum→int cast stranded at emit → E99999). Facts verified against source at PR head:

- `lowerEnumType::processInst` (source/slang/slang-ir-lower-enum-type.cpp:122-137) handles EXACTLY {EnumType, CastEnumToInt, CastIntToEnum, EnumCast}; `default: break`. Its `processModule` walks every module inst and `replaceUsesWith`es all registered IREnumType→tag at the end (lines 157-159). So once scheduled, it fixes ALL enum-typed uses, not just the cast ops.
- The gate `calcRequiredLoweringPassSet` (slang-emit.cpp:404) switches on OPCODE and recurses only over `getDecorationsAndChildren()` (line 588). It does NOT descend into type operands — but it doesn't need to: an IREnumType is a global hoistable inst parented under the module, so any live enum-typed value keeps it alive (type-operand use → not DCE'd → still a module child → the `kIROp_EnumType` arm fires). Note line 570-587 has a dedicated "inst-whose-TYPE-needs-lowering" provision but ONLY for InterfaceType (via getDataType()), not enum. So opcode-only gating on {EnumType + 3 casts} IS complete for enum: the only residual case is exactly the bug — IREnumType folded away but a degenerate cast survives on tag-typed operands.
- Constexpr* enum casts (ConstexprCastEnumToInt/IntToEnum/EnumCast, Lua ~3379, hoistable) are produced by EXACTLY ONE path: `IRBuilder::emitConstexprCast` (slang-ir.cpp:4382), called only from `visitTypeCastIntVal` (slang-lower-to-ir.cpp:1944) — i.e. compile-time-constant IntVal contexts only, never runtime value flow. That's why excluding them from the gate is SAFE.
- IMPORTANT NUANCE: the "constant-folded by SCCP" justification is imprecise. SCCP's evalInst guards on result being IRBasicType (slang-ir-sccp.cpp:1026) and evalCast (334) only folds int/float/bool target types → getAny() for enum-typed results. So SCCP folds ConstexprCastEnumToInt (int result) but NOT ConstexprCastIntToEnum/ConstexprEnumCast (enum result). The correct safety argument is "IntVal-context-only production" + "lowerEnumType has no case for them, so flagging enumType on them would schedule a pass that can't lower them (false coverage)".
- The E99999 the bug hits is the emitter fallthrough at slang-emit-c-like.cpp:2347 (Diagnostics::Unimplemented, "unexpected IR opcode during code emit"). `checkUnsupportedInst` (slang-ir-check-unsupported-inst.cpp:150) only covers opaque handles/strings — it does NOT flag enum casts.
- lowerEnumType scheduled at slang-emit.cpp:1276 gated on `requiredLoweringPassSet.enumType`.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1783706489119-slang-enum-cast-lowering-gate-calcrequiredlowering.md`_
