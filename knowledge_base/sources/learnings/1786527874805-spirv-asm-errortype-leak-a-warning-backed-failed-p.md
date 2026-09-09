---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1786526528077-loh56h
written_at: 2026-08-12T09:44:34.805Z
---

# spirv_asm ErrorType leak = a warning-backed failed path slips past the error-count gate

shader-slang/slang#12497: `spirv_asm { OpNop %x; }` (a stray operand on a ZERO-operand SPIR-V opcode) emits `warning[E29106] too many operands` then ABORTS with `error[E99997] ... N5Slang13InternalErrorE unexpected: ErrorType`. Verified @ HEAD 5e846cbe3.

ROOT CAUSE — a warning-vs-error asymmetry across a set of sibling failure paths:
- `SemanticsExprVisitor::visitSPIRVAsmExpr` (slang-check-expr.cpp:9529) has ~7 `failed=true` sites. When `failed`, it `return CreateErrorExpr(expr)` (:9757) → the expr gets an **ErrorType**.
- The front-end gate `if (getSink()->getErrorCount() != 0) return SLANG_FAIL;` (slang-compile-request.cpp:607, right after checkAllTranslationUnits) is what stops an error-typed expr from reaching generateIR(). It keys on ERROR count, not on whether any expr is error-typed.
- SIX of the seven failed sites emit an `err(...)` diagnostic (E29112 not-enough-operands, E29113 id-redefinition, MisplacedResultIdMarker, SpirvUnableToResolveName, SpirvUndefinedId, SpirvNonConstantBitwiseOr) → error count > 0 → gate bails cleanly.
- The ONE exception: the zero-operand branch (slang-check-expr.cpp:9551, `opInfo->numOperandTypes==0 && operands present`) diagnoses SpirvInstructionWithTooManyOperands **E29106**, which is a `warning(...)` (slang-diagnostics.lua:1089). So error count stays 0, the gate does NOT bail, generateIR() runs, lowering does `lowerType(context, expr->type)` on the ErrorType (slang-lower-to-ir.cpp:6152) → `UNEXPECTED_CASE(ErrorType)` (:3051) → `SLANG_UNEXPECTED("ErrorType")` = the abort.
- The OpLoad "too many operands" sibling (tests/language-feature/spirv-asm/too-many-operands.slang) recovers precisely because OpLoad has numOperandTypes>0: the :9551 branch never fires, and its extra operands become undefined-id ERRORS.

REUSABLE LESSONS:
1. When a checker sets an ErrorType (CreateErrorExpr / getErrorType) it MUST also raise the sink's error count, or the error-typed node leaks past the getErrorCount()==0 gate into lowering/emit where `unexpected: <TypeName>` aborts. A `failed`/error-typed return backed by only a WARNING is the bug shape. Audit: every `failed=true`/CreateErrorExpr path should pair with an `err(...)`, not a `warning(...)`.
2. E99997 is a generic WRAPPER diagnostic; the true identity is the message ("unexpected: ErrorType"). SLANG_UNEXPECTED fires in Release too (unlike SLANG_ASSERT). Match on the message, not the code.
3. Fix at the producer (make the diagnostic an error) — NOT by teaching lowering to tolerate an ErrorType (that masks; an ErrorType reaching lowering IS the defect). But do NOT flip a shared diagnostic globally: E29106 is reused by the parser as an intentional warning-with-semicolon-hint.
