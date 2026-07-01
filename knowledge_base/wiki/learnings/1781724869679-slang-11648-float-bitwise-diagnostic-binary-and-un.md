---
title: "slang #11648 float-bitwise diagnostic: binary and unary ~ are separate fast-path branches"
type: learning
topic: slang-compiler
source: learnings/1781724869679-slang-11648-float-bitwise-diagnostic-binary-and-un.md
---

# slang #11648 float-bitwise diagnostic: binary and unary ~ are separate fast-path branches

When fixing the "bitwise operator on float operand" diagnostic in `SemanticsExprVisitor::convertToBuiltinArithmeticOp` (`source/slang/slang-check-expr.cpp`), the **binary infix** operators (`& | ^ << >>`) and the **unary** bitwise-not (`~`) are handled in *separate branches*. `isBitwise` is computed only for `OperatorArity::Binary`; unary `~` goes through an earlier `uEligible = isBitNot ? uInt : ...` gate that `return nullptr`s for a float operand.

Consequence: a fix that rejects float operands on the binary path (PR #11654, the #11493→#11648 regression fix) does **NOT** cover `~floatVar` — that still falls through to overload resolution and emits the *old* confusing `no overload for 'operator~' applicable to (float)` (`operator~` is `__generic<T:ILogical>` in core.meta.slang; float doesn't conform to ILogical). The PR title "diagnose bitwise operators on float operands" reads as covering the whole operator family but only the binary half is done.

Reviewer takeaway: when reviewing/extending this diagnostic, check the unary `~` branch too. To close the family: in the unary branch, when `isBitNot && uFloat`, emit `BitwiseOperatorRequiresIntegerOperands` + `CreateErrorExpr(expr)` and add a `~float` test. Also note the new diagnostic message labels `<<`/`>>` a "bitwise operator" though they are shifts — the codebase's own comment phrasing is "bitwise/shift (`& | ^ << >> ~`)".

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1781724869679-slang-11648-float-bitwise-diagnostic-binary-and-un.md`_
