---
title: "slang propagateConstExpr's paramCount==callArgCount asserts BEFORE the autodiff pass — fix is front-end"
type: learning
topic: slang-compiler
source: learnings/1779369269598-slang-propagateconstexpr-s-paramcount-callargcount.md
---

# slang propagateConstExpr's paramCount==callArgCount asserts BEFORE the autodiff pass — fix is front-end

`propagateConstExpr` (slang-ir-constexpr.cpp ~line 504/523, in `propagateConstExprBackward`) is invoked from `slang-lower-to-ir.cpp:14662`, gated on `shouldRunNonEssentialValidation()`. That runs BEFORE `finalizeAutoDiffPass` (slang-emit.cpp ~1284). When you see:

```
error[E99997]: ... assert failure: slang-ir-constexpr.cpp(504): paramCount == callArgCount
```

the IR being checked is the FRONT-END output of `visitInvokeExprImpl`/`emitCallToDeclRef`, NOT the post-autodiff translation. The triage instinct to point at `slang-ir-autodiff-fwd.cpp::translateCall` (and its sibling assertion at line 1193) is misleading — translateCall hasn't run yet. The bug is in how the original IRCall was constructed.

Concrete failure mode for `__fwd_diff(curve.eval)(args)` on an interface/generic-constrained member method (issue #11004): the semantic checker's `convertHigherOrderExprToLookup` rewrites it into a `(curve.eval.fwd_diff)(args)` form whose AST is a `StaticMemberExpr` (because `fwd_diff` is `static __associatedfunc`) wrapping a `SharedTypeExpr` whose `base.exp` preserves the original receiver. Two front-end gaps drop the receiver:

1. `tryResolveDeclRefForCall` in slang-lower-to-ir.cpp doesn't surface the preserved receiver for `StaticMemberExpr`, so `visitInvokeExprImpl`'s implicit-`this` path never runs.
2. `FwdDiffFuncType::_resolveImplOverride()` (slang-ast-type.cpp ~893) substitutes the underlying member method's `this` into the resolved `FuncType` as its first parameter; the existing prepend-this branch in `visitInvokeExprImpl` then double-counts.

Recon technique that worked: instrument `slang-ir-constexpr.cpp` with `dumpIRToString(callInst)` at the failing site to see the call shape. Watch out for the LD_LIBRARY_PATH ordering gotcha (separate learning) — silence ≠ "code path not reached."

Test trick: `//TEST:SIMPLE(filecheck=CHECK): -target spirv-asm -entry fs -stage fragment` exercises the failing path WITHOUT a GPU because `propagateConstExpr` only runs on the SPIRV codegen path (it's behind the non-essential validation flag), and `spirv-asm` is the disassembled form FileCheck can match against.

Don't paper over the constexpr.cpp:504 assert — it's load-bearing. Fix the IR construction in `visitInvokeExprImpl`/`tryResolveDeclRefForCall`. PR #11234 is the canonical example.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1779369269598-slang-propagateconstexpr-s-paramcount-callargcount.md`_
