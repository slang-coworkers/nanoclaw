---
title: "SPIR-V asm-operand legalization: hoistable operands + foldable≠constant pitfalls"
type: learning
topic: slang-compiler
source: learnings/1781726667133-spir-v-asm-operand-legalization-hoistable-operands.md
---

# SPIR-V asm-operand legalization: hoistable operands + foldable≠constant pitfalls

From slang#9382 (Gather ConstOffset / ImageGatherExtended; PR #11655). Two non-obvious traps when an IR-legalize pass rewrites `spirv_asm` block operands (slang-ir-spirv-legalize.cpp):

**1. SPIR-V asm-operand enums/literals are HOISTABLE — never mutate them in place.**
`SPIRVAsmOperandEnum` and `SPIRVAsmOperandLiteral` are `hoistable = true` in slang-ir-insts.lua (value-numbered/deduplicated). `SPIRVAsmOperandInst` and `SPIRVAsmInst` are NOT. Mutating a hoistable operand's value (`maskOperand->setOperand(0, newLit)`) trips the assert at `slang-ir.cpp:179` (`IRUse::set`: "Normally we should never be modifying the operand of an hoistable inst"). Correct fix: build a FRESH operand and either `replaceUsesWith` it, or `setOperand` on the non-hoistable CONSUMER (e.g. `spvInst->setOperand(maskIndex+1, newOperand)` on the gather inst). This mirrors the existing `processConvertTexel` pattern (emit new operand → replaceUsesWith). A stale draft PR can carry this latent bug uncaught (the #9741 it revived used in-place mutation and was never merged/CI'd).

**2. "Constant-FOLDABLE" ≠ "emitted as a SPIR-V constant object."** When choosing `ConstOffset` (which requires the operand to be an `OpConstant`/`OpConstantComposite`) vs `Offset`, only classify as constant the shapes that emit as actual constants: `IRConstant` leaves + `Make{Vector,Array,Struct,Matrix,VectorFromScalar}` of constants. Do NOT use `isEvaluableOpCode` (SCCP's foldability predicate) — arithmetic like `-int2(2,1)` = `Neg(MakeVector(...))` is emitted as a RUNTIME `OpSNegate` at IR-legalize time, so forcing `ConstOffset` on it is invalid SPIR-V ("Expected Image Operand ConstOffset to be a const object" — the #5339 CTS failure). spirv-opt folds such expressions to constants LATER and rewrites the operand, but the IR-legalize pass runs before that, so a foldability test mis-predicts. Verify with `-target spirv SLANG_RUN_SPIRV_VALIDATION=1` (NOT just `-target spirv-asm`, which runs spirv-opt and masks the pre-fold invalid state). A reviewer (incl. codex) observing the POST-opt asm can wrongly conclude the expression "is a constant" — push back with the validation error.

**3. `MakeVectorFromScalar` operand layout:** the real inst has ONE operand (the scalar, `getOperand(0)`); element type/count live in the result type. The FIDDLE-generated `getScalarValue()` returns `getOperand(2)` (matching the lua textual form `%T %N %val`) and asserts out-of-bounds on the real inst. Read `getOperand(0)` (as slang-emit-spirv.cpp does), or just recurse all operands.

General: for any SPIR-V image-operand capability fix, the runtime path is often reachable via the GLSL-source intrinsic feeding the same core-module `spirv_asm` block — the safe default for "not provably a constant object" is keep `Offset`+capability (valid), never force `ConstOffset`.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1781726667133-spir-v-asm-operand-legalization-hoistable-operands.md`_
