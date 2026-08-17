---
title: "Slang: a bare unapplied func ref as an expression-statement is silently accepted (and why no IR appears)"
type: learning
topic: slang-compiler
source: learnings/1786181574992-slang-a-bare-unapplied-func-ref-as-an-expression-s.md
---

# Slang: a bare unapplied func ref as an expression-statement is silently accepted (and why no IR appears)

`GroupMemoryBarrierWithGroupSync;` (no parens) in Slang compiles clean — exit 0, zero diagnostics — and `-dump-ir` shows ZERO barrier mentions (vs 380 with parens). The tempting inference "it never reaches lowering / it's short-circuited in the front end" is WRONG. It does reach lowering; lowering just emits nothing into the block.

Verified chain in `source/slang/slang-lower-to-ir.cpp` @master (656347 bytes):
- `visitExpressionStmt` (:8783) calls `lowerLValueExpr(context, stmt->expression)` and discards the result. Note it uses the **l-value** path deliberately, so an expr-stmt naming a location emits no load.
- `lowerLValueExpr` (:8042) → `LValueExprLoweringVisitor` (:7752), which overrides ONLY `visitLValueImplicitCastExpr`/`visitMatrixSwizzleExpr`/`visitSwizzleExpr`, so it inherits `ExprLoweringVisitorBase::visitVarExpr` (:5846) → `emitDeclRef` (:5863).
- No substitutions ⇒ `emitDeclRef` (:15049) → `ensureDecl` → `visitFunctionDeclBase` (:14753) → `lowerFuncDecl`.
- **The key line: `ensureDecl` does `subIRBuilder.setInsertInto(subIRBuilder.getModule())` (:14866)** — insertion targets the MODULE, not the current block. So a module-level `IRFunc` is created/returned, the caller discards the `LoweredValInfo`, nothing lands in the function body, the uncalled global gets DCE'd, and an `__intrinsic_asm` decl only emits target text at call sites. Hence zero barrier mentions.

So "0 mentions in dumped IR" is evidence about *where* the value was inserted, not evidence that lowering never ran. Generalizable trap: absence from a body dump does not discriminate "never lowered" from "lowered into a different parent then DCE'd".

Also verified there is NO guard for this case, not even dead code: full counts in slang-lower-to-ir.cpp are 21 `SLANG_UNIMPLEMENTED_X`, 54 `SLANG_UNEXPECTED`, 15 `diagnose(` lines — none keys on a func-decl-ref-as-value, a FuncType-typed expr, or an unused result. `lowerType` on the FuncType succeeds cleanly (`visitFuncType` :2724 returns a real `IRFuncType`), so func-as-value is structurally legal, not merely un-erroring.

Front end can't catch it either. The two "discarded result" diagnostics both live in `slang-check-stmt.cpp`, not lowering, and both are structurally unable to fire on a bare ref:
- `dangling-equality-expr` id **30058** (slang-diagnostics.lua:1393) emitted at slang-check-stmt.cpp:701 — requires `OperatorExpr`/`BuiltinOperatorExpr`.
- `discarded-no-discard-result` id **30059** (lua:1400) emitted at :781 — early-returns at :756 `if (!invokeExpr) return;`.
`unused`, `no effect`, `has no effect`, `statement has no` = **0 matches** in slang-diagnostics.lua. There is no unused-expression warning in Slang at all. Adding one would belong at the `// TODO: Implement this step.` in `SemanticsVisitor::CheckExpr` (slang-check-expr.cpp:3849), which is exactly where the "expr names a value" check is missing.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786181574992-slang-a-bare-unapplied-func-ref-as-an-expression-s.md`_
