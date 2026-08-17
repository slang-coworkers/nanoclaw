---
title: "slang autodiff: PR #10827 left BwdDiffFuncType/RematFuncType/BwdCallableFuncType/FwdDiffFuncType inconsistent with ApplyForBwdFuncType + IR-pass + front-end"
type: learning
topic: slang-compiler
source: learnings/1780050112745-slang-autodiff-pr-10827-left-bwddifffunctype-remat.md
---

# slang autodiff: PR #10827 left BwdDiffFuncType/RematFuncType/BwdCallableFuncType/FwdDiffFuncType inconsistent with ApplyForBwdFuncType + IR-pass + front-end

PR #10827 (`65d2b9e3a`, "Implement SP #039: __func_extension", merged 2026-05-26) added a `this`-type slot to four AST-level autodiff func-type resolvers in `source/slang/slang-ast-type.cpp` for non-static member methods:

- `BwdCallableFuncType::_resolveImplOverride` (lines 478-518)
- `BwdDiffFuncType::_resolveImplOverride` (lines 809-853)
- `RematFuncType::_resolveImplOverride` (lines 716-720)
- `FwdDiffFuncType::_resolveImplOverride` (lines 972-1011)

But it did NOT add `this` to the fifth resolver `ApplyForBwdFuncType::_resolveImplOverride` (lines 593-688), did NOT update the IR-level autodiff translator at `slang-ir-autodiff-rev.cpp:712-857` (which assumes `bwdDiffFuncType.params` is param-for-param the same shape as `applyForBwdFuncType.params`, modulo Diff-pair wrapping), did NOT update the IR-level remat construction at `slang-ir-autodiff-rev.cpp:412-418` (which builds remat as `(MinCtx, *applyForBwdParams)` — no this), and did NOT update the front-end `InvokeExpr` lowering at `slang-lower-to-ir.cpp:4974` (which asserts `argCount == funcType->getParamCount()`).

**Symptom (#11356):** `__bwd_diff(obj.method)(args)` on a non-static member with `[Differentiable][NoDiffThis]` segfaults on Release / asserts at slang-lower-to-ir.cpp:4974 in Debug. The user's call provides `argCount = N+1` (params + dOut, no `this`); resolved `BwdDiffFuncType.paramCount = N+2` (extra `this` slot at index 0). The PR's `tests/autodiff/func-extension/member-method/bwd-diff-*` tests don't catch this because they all use the new `__func_extension` desugar syntax, not the auto-witness `__bwd_diff(obj.method)` path.

**Failed quick-fix attempt** (don't repeat): reverting `this`-add in all four resolvers breaks the core module — `core.meta.slang:695:12` declares `static __associatedfunc FwdDiffFuncType<FType> fwd_diff` and the matching `[ForwardDerivative(__store_forward)]` etc. derivatives at `diff.meta.slang:1027, 1133, 1138, 1168, 1173, ...` were updated by PR #10827 to have signatures matching the new (with-`this`) shape. So resolver and meta.slang declarations are coupled.

**Proper fix paths** (need PR author @saipraveenb25 input):
(a) Add front-end auto-prepend of receiver for `__bwd_diff(obj.method)` in `slang-check-expr.cpp::convertHigherOrderExprToLookup` (line 3821) or `visitInvokeExpr` (line 4322).
(b) Update IR translator at `slang-ir-autodiff-rev.cpp:712-857` to consume the `this` slot at index 0 before iterating apply-params, and update remat construction at line 412-418 to include `this`.
(c) Selective opt-out: resolver doesn't add `this` when context is a bound-member invocation.

**Useful debug observation:** Debug builds catch the param-count mismatch at the assertion (`slang-lower-to-ir.cpp:4974`), Release builds segfault later because `addDirectCallArgs` falls into the empty-default-arg branch with a null `argExpr`. The Debug error message is much more diagnostic than the user-reported Release segfault.

**Confirming the design intent:** see comment at `slang-check-decl.cpp:9146-9150` — *"NOTE: bwd_diff is now static in the interface, so this-type handling (both differentiable and non-differentiable) is done by BwdDiffFuncType::_resolveImplOverride."* This tells you the author intended a static-style call where `this` is passed as the first arg.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1780050112745-slang-autodiff-pr-10827-left-bwddifffunctype-remat.md`_
