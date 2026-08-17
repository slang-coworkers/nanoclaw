---
title: "Never mutate a hoistable SPIRVAsmOperand in place; repoint the consuming inst"
type: learning
topic: slang-compiler
source: learnings/1781725591470-never-mutate-a-hoistable-spirvasmoperand-in-place-.md
---

# Never mutate a hoistable SPIRVAsmOperand in place; repoint the consuming inst

# Rewriting a SPIR-V asm-block operand in slang-ir-spirv-legalize.cpp

**Rule:** To change an operand of an `IRSPIRVAsmInst` (e.g. flip an `OpImageGather` image-operands mask from `Offset` to `ConstOffset`), do NOT mutate the existing operand inst in place. `SPIRVAsmOperandEnum`/`SPIRVAsmOperandLiteral` are *hoistable* (value-numbered, deduplicated, possibly shared) — calling `maskOperand->setOperand(0, newLit)` on one corrupts IR value-numbering and trips `slang-ir.h:711 SLANG_ASSERT(index < getOperandCount())` / the hoistable-use assert. Instead: build a fresh operand with `IRBuilder::emitSPIRVAsmOperandEnum(builder.getIntValue(...))` (insert before the asm inst) and repoint the NON-hoistable consuming instruction: `spvInst->setOperand(maskIndex + 1, newOperand)`.

**Why operand index = maskIndex + 1:** `IRSPIRVAsmInst` operand 0 is the opcode; `getSPIRVOperands()` returns operands starting at index 1. So an operand at position `maskIndex` within `getSPIRVOperands()` is at `maskIndex + 1` in the full operand list.

**Discovered:** slang#9382 / PR #11655 (2026-06-17). First cut used in-place `maskOperand->setOperand(0,...)` and crashed on `int2(1)` (a `MakeVectorFromScalar` constant offset). Repointing the gather inst (which is not hoistable — it has a result/side effects) is the correct mutation.

**Related:** when classifying a constant offset for the const/runtime branch, `isIRConstantValue` must recognize `kIROp_MakeVectorFromScalar` (scalar splat like `int2(1)`), not only `MakeVector`/`MakeArray`/`MakeStruct`/`MakeMatrix`. Treat unrecognized shapes as runtime — safe default (keeps valid `Offset`, only forgoes the capability optimization). To add the `ImageGatherExtended` capability for a runtime offset, synthesize an in-block `OpCapability` asm inst (`emitSPIRVAsmOperandEnum` + `emitSPIRVAsmInst`); the emitter hoists in-block capabilities to module scope and dedups them.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1781725591470-never-mutate-a-hoistable-spirvasmoperand-in-place-.md`_
