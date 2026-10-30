---
title: "Slang error handling: throws, try, catch — checking and lowering"
type: concept
group: slang-language-core
tags: [slang, throws, try, catch, errorType, bottom-type, visitTryExpr, TryCall, lowerErrorHandling, lambda, accessor, overload-resolution, front-end, Result-void, getResultError, lowerResultType, noinline, peephole]
source_count: 8
---

# Slang error handling: throws, try, catch — checking and lowering

How Slang's `throws`/`try`/`catch` feature is represented on callables, checked at the `try` site, and lowered to `Result<T,E>`, and the October 2026 bug cluster (#13488–#13492) that showed where each layer is incomplete.

## TL;DR

- Every callable's "does not throw" default (`errorType = Bottom`) is set in exactly one place, `checkCallableDeclCommon`. Property/subscript accessors never reach it and have no `throws` syntax, so their `errorType` is null.
- Read a callee's error type through `getErrorCodeType(astBuilder, declRef)`: it substitutes generic arguments and maps null to Bottom. Reading `funcDecl->errorType` off the bare decl is wrong twice: generic `throws E` never matches at the call site, and accessors segfault.
- A crash on a null accessor `errorType` is fixed where the Bottom default is set for accessors, not with a guard at the consumer.
- `visitTryExpr` keeps the enclosing try clause set while the whole operand is checked, but only the outermost call is validated and lowered as a `TryCall`. So `try g(f())` escapes E30094 and miscompiles: the nested throwing call lowers as a plain `Call`.
- `lowerErrorHandling` changes every throwing function to return `Result<T,E>` but rewrites only `TryCall`/`Throw`/`Return`, so any plain `Call` to a throwing function passes the `Result` wrapper on as the value (invalid HLSL/SPIR-V, on every release since `throws` landed in 2025.12).
- A throwing `[Differentiable]` function fails because `addSynthesizedFunc` / `trySynthesizeDiffFuncRequirementWitness` never copy `errorType` onto the synthesized derivative members (the requirement types already carry it). Copying it fixes declaration and primal calls; differentiation still breaks because `lowerErrorHandling` runs before autodiff.
- The principled fix marks the try on each throwing `InvokeExpr` during checking, validates every covered call, and makes `visitTryExpr` an identity wrapper. Short-circuit and `?:` arms already lower into separate blocks, so per-call marks stay correct there.
- Lambda bodies are checked twice. Pass 1 runs inside the enclosing function's context; pass 2 re-checks statements but not expressions. Expression-level checks such as the try-clause check see only the leaked outer context, so a lambda inside a `try` operand or a `defer` gets wrong diagnostics.
- A lambda-context fix must neither clear the outer statement stack (optional-witness refinement needs the enclosing `if`) nor skip pass 2 (it does return coercion). A null-statement boundary node works.
- "Overload resolution always gives the callee a `FuncType`" is false: the member reference can still be rejected after overload selection (static↔instance, `this` in a static), leaving an `ErrorType` callee under a non-error call. Probe overloaded callees, not just single candidates, before asserting such an invariant.
- A diagnostic that depends on how the ENCLOSING call resolves (`try int(f())` is an identity conversion) is collected on a pending list during operand checking and settled after resolution at every early exit, never by re-checking the operand.
- `BottomType`/`Never` is used only as the throws error type, not as a noreturn marker.
- `Result<void,E>`'s `getResultError` returns the whole lowered `{tag, AnyValue}` struct, a leftover from before #6916. The peephole folds `GetResultError(MakeResultError(e))` once the thrower is inlined, so a repro needs a `[noinline]` void thrower; a rethrow then silently delivers `tag ? 1 : 0` as the error (#14066).

## Representation: `errorType` and the Bottom default

Every callable carries an `errorType`; "does not throw" is `Bottom`. That default is assigned only in `SemanticsDeclHeaderVisitor::checkCallableDeclCommon` (slang-check-decl.cpp ~:16377), which runs for `FuncDecl`, `ConstructorDecl` and `SubscriptDecl` but not from `visitAccessorDecl` or `visitSetterDecl`. Accessors also have no `throws` syntax (`parseAccessorDecl`), so `GetterDecl`/`SetterDecl`/`RefAccessorDecl::errorType.type` stays null. Readers that go through `getErrorCodeType()` (slang-syntax.h ~:601), such as lowering and `getFuncType`, are safe because it maps null to Bottom. Readers that dereference `parentFunc->errorType->equals(...)` directly, `visitThrowStmt` and `visitTryExpr`, segfault on accessors (#13489). The fix belongs where the Bottom default is set, extended to accessors; a null check in each consumer is the wrong layer [accessors never get the Bottom errorType default](../learnings/1791396718277-slang-property-subscript-accessors-never-get-the-b.md). Related shapes: `_emitCallToAccessor` hard-codes `TryClauseEnvironment()` (slang-lower-to-ir.cpp ~:4940), and `LambdaExpr` is not a `CallableDecl`, so a lambda has no `errorType` field at all.

The same bare-decl read breaks generic error types. Consider:

```slang
struct MyError { int code; }
int f<E>(int x) throws E { ... }
int caller(int x) throws MyError { return try f<MyError>(x); }
```

On master 9f31ffcfd and on 2025.23.2 this fails with E30095 ("error type `E` of callee ... not compatible"); under a matching `catch (e: MyError)` it fails with E30093. A generic interface `IT<E> { int call(int) throws E; }` and a generic struct method fail the same way. `visitTryExpr` (slang-check-expr.cpp ~7778-7817) reads `funcCallee->errorType` from the bare decl, so it sees the unsubstituted `E`; `getErrorCodeType(astBuilder, declRef)` substitutes. Until that is fixed, a throwing `IFunc` variant that is generic over its error type cannot be called through `try` [generic `throws E` fails at the try site](../learnings/1791396633466-slang-throws-e-with-a-generic-error-type-fails-at-.md). The meaning of `Bottom` itself (only the throws type, not divergence) is on [[wiki/concepts/misc-f0909b4-slang-compiler-and-test-facts.md]].

## Checking and lowering a `try`: nested throwing calls

`visitTryExpr` (slang-check-expr.cpp ~:7753) sets `m_enclosingTryClauseType` for the whole operand, including the callee and arguments that `visitInvokeExpr` checks. That suppresses E30094 ("call to throwing function must be in a try", ~:4285) for every nested throwing call, but the checker validates only the top `InvokeExpr` and records nothing on the nested ones, and lowering passes a `TryClauseEnvironment` only to that top call (slang-lower-to-ir.cpp ~:7336/:8211). Then `lowerErrorHandling` changes every throwing function's return type to `Result<T,E>` (slang-ir-lower-error-handling.cpp:34-55) but rewrites only `TryCall`, `Throw` and `Return` (:180-199). In `try g(f())`, the inner `f()` stays a plain `Call` and its `Result` is passed to `g` as an `int`: HLSL `g_0(f_0())`, and invalid SPIR-V. This holds on every release since `throws` syntax landed (2025.12 onward) (#13491/#13489).

Resetting the try clause to None for the callee and arguments inside `visitInvokeExpr` restores E30094 as a stopgap [same](../learnings/1791396718277-slang-property-subscript-accessors-never-get-the-b.md). The fuller prototype, which passed 7536/7537 of the full suite, makes nested try a supported shape: record the try on each throwing `InvokeExpr` in `CheckInvokeExprWithCheckedOperands`, validate every covered call in `visitTryExpr`, have `visitInvokeExpr` read the mark when lowering, make `visitTryExpr` an identity wrapper, and reset the try context in `withParentLambdaExpr` (slang-check-impl.h ~:1511), which currently leaks it into lambda bodies. Short-circuit `&&`/`||` and `?:` arms already lower into separate blocks, so a nested throwing call becomes a `TryCall` only on the path that evaluates it. Separately, `findErrorHandler` (~:854) steps with `context->catchHandler->prev` instead of `handler->prev` (#12362) [`try g(f())` miscompiles: nested throwing calls lower as plain Call](../learnings/1791399033479-slang-try-g-f-miscompiles-nested-throwing-calls-lo.md).

**A diagnostic that depends on how the enclosing call resolves is decided with a pending list (#13514).** Consider `try int(f())`. The conversion is an identity, so `ResolveInvoke` returns `f()` itself and the `try` does cover `f()`, but E30094 for `f()` is decided while `f()` is checked, which is earlier. The shape that worked checks the operand through a `SemanticsVisitor(withX(...))` sub-context carrying a pointer to a local `List<InvokeExpr*>`; the diagnostic site appends to that list instead of diagnosing. After `CheckInvokeExprWithCheckedOperands`, the list is settled: an entry is re-judged only if `entry == resolvedExpr`, and every other entry is diagnosed. The settle has to run at every early exit after the argument loop: in `visitInvokeExpr` that is `convertToLogicOperatorExpr`, `convertToBuiltinArithmeticOp`, the functor `operator()` lookup error and the normal exit, and in `visitTypeCastExpr` the legacy `(S)0` return. Non-identity boundaries (index, operator, multi-arg, callee) pass `nullptr`, so a pending entry cannot leak across them. Re-checking the operand instead duplicates side diagnostics, and suppress-then-re-emit loses the site. The test is `invoke == resolved`, not `resolved == arguments[0]`, so `int(f().x)` still diagnoses `f()`. Two test tips from the same PR: a `DIAGNOSTIC_TEST:SIMPLE(diag=CHECK)` with no annotations is a valid exhaustive "nothing reported" test, and when another open PR adds a second diagnostic on the same span, `DIAGNOSTIC_TEST:SIMPLE(filecheck=CHECK)` with `file:[[# @LINE+1]]:col` keeps the test independent of which PR lands first [decide an enclosing-call-dependent diagnostic with a pending list](../learnings/1791542677184-slang-checker-decide-a-diagnostic-that-depends-on-.md).

## Throwing `[Differentiable]` functions: synthesized derivative members drop `errorType` (#13508)

A `[Differentiable]` function that `throws` fails because the members synthesized to satisfy its derivative requirements lose the error type, not because the requirement types are wrong. At master f6a839924 the expected requirement types (the FwdDiffFuncType / ApplyForBwdFuncType / RematFuncType / BwdDiffFuncType / BwdCallableFuncType resolvers in slang-ast-type.cpp) already copy the primal's error type. The synthesized members do not: `addSynthesizedFunc` (slang-check-decl.cpp:15450) and `trySynthesizeDiffFuncRequirementWitness` (:9418) set the parameters and return type but never `errorType`. The exact canonical function-type match (:5564) therefore fails, giving E38105 three times and then the release assert at :10937. Copying `errorType` (two lines) fixes the declaration and primal calls. Actually differentiating still breaks, because `lowerErrorHandling` (slang-lower-to-ir.cpp:15563) runs before autodiff, so the derivative returns a `Result<T,E>` that carries only the primal. A non-throwing user derivative cannot be wrapped either: the method wrapper takes its error type from `getErrorCodeType(req)`, which reads `decl->errorType`, while `__associatedfunc` requirements keep their signature in `funcType`, and `setFuncTypeIntoRequirementDecl` has no callers. Build note: a `slangc`-only target build lacks the `functional` standard module, which gives 13 false failures in tests/functional and the dispatcher, so build the full Release target before a sweep [throwing [Differentiable] fails because synthesized derivative members drop errorType](../learnings/1791996535059-throwing-differentiable-fails-because-synthesized-.md).

## Lambda bodies are checked twice, and the outer context leaks into pass 1

`visitLambdaExpr` (slang-check-expr.cpp ~8166) checks a lambda body with the enclosing function's context: `m_parentFunc` and `m_outerStmts` both belong to the enclosing function. Later, `visitFunctionDeclBase` (slang-check-decl.cpp ~13602) checks the synthesized `()` again under `withParentFunc`, which clears `m_outerStmts`. Statement checks (`throw`, `break`, `continue`) are re-diagnosed in pass 2, which makes leaks look harmless and reports some errors twice (two E30115). Expressions are not re-checked, because `CheckTerm` returns early on `checked`, so expression-level checks such as `visitTryExpr` (#13490) and every `FindOuterStmt<DeferStmt>` lookup see only the leaked context. The results are a missed E30093 (an ICE in lowering) and a false E30110 for a lambda's `return` inside a `defer` body.

Two constraints shape the fix. First, the lambda body cannot simply get a null `m_outerStmts`: optional-witness refinement (`if (T is I)`, check-expr ~1331) must still see the enclosing `if`, and clearing the stack gives E30403. A null-statement boundary node works, since `FindOuterStmt` already stops at `stmt == nullptr`. Second, pass 2 cannot be skipped for `LambdaDecl`: pass 1 skips return coercion inside a lambda (check-stmt ~622) and pass 2 performs it, and `lambda-diagnostics.slang` breaks without it [lambda bodies are checked twice; statement-stack leaks hidden by pass 2](../learnings/1791398551841-lambda-bodies-are-checked-twice-statement-stack-le.md). Module-scope lambda naming is a separate issue, on [[wiki/concepts/slang-language-visibility-and-layout.md]].

## Callee shapes at the try site: probe overloaded and rejected-member callees

PR #13503 (#13488) added `SLANG_RELEASE_ASSERT(as<FuncType>(callee->type))` in `visitTryExpr`, on the reasoning that every resolved callee is `FuncType`-typed and a failed one makes the call itself `ErrorType`. About 45 error-recovery probes never tripped it; a peer reviewer did with:

```slang
struct S {
    int m(int x) { return x; }
    int m(float x) { return 0; }
    static int s() { return try m(1); }
}
```

`ConstructLookupResultExpr` can still reject the member reference after overload selection (E30100 static-to-non-static, E30120 `this.m` from a static), which leaves the callee as `ErrorType`. `ResolveInvoke` bails on `IsErrorExpr(funcExpr)` only on the single-candidate path, while `CompleteOverloadCandidate` (Flavor::Func) still set the call's type to `candidate.resultType`, so consumers that early-return on an `ErrorType` call never saw the error. The producer fix is in Flavor::Func: `if (IsErrorExpr(baseExpr)) return CreateErrorExpr(callExpr);`. Before asserting "overload resolution always produces X," probe every flavor (Func / Generic / Expr) against both a single candidate and an overloaded set, and against a member reference rejected after selection; the single-candidate path proves nothing about the overloaded one [probe overloaded + erroneous-member callees before asserting an AST invariant](../learnings/1791418093072-before-asserting-an-ast-invariant-at-a-consumer-pr.md).

## `Result<void,E>` error extraction, and why tests miss it (#14066)

`getResultError` (`slang-ir-lower-result-type.cpp:155-172`) returns the whole lowered `{tag, AnyValue}` struct for `Result<void,E>`. It is left over from before #6916, when `Result<void,E>` lowered to plain `E`. Existing error-handling tests pass because their void throwers are inlined: after inlining, `slang-ir-peephole.cpp:419` folds `GetResultError(MakeResultError(e))` before the result type is lowered. A repro or regression test therefore needs `[noinline]` on the void thrower [Slang Result<void,E> catch bugs only reproduce with [noinline]; void→value rethrow is a silent wrong value](../learnings/1793316146558-slang-result-void-e-catch-bugs-only-reproduce-with.md).

The worst shape is a rethrow through a void callee:

```slang
[noinline] uint relay() throws uint { try voidFail(c); return 5; }
```

The rethrow packs `tag ? 1 : 0` as the error. The emitted HLSL and SPIR-V are valid (the SPIR-V passes spirv-val), and the catcher receives 1 on vk, cuda and cpu, a silent wrong value. Separately, slang-test on `-vk` segfaults when the emitted SPIR-V is invalid (for example an `OpReturnValue` type mismatch that reaches the NVIDIA driver), so read a slang-test core dump on `-vk` as "check the `SLANG_RUN_SPIRV_VALIDATION` output first", not as a harness bug [Slang Result<void,E> catch bugs only reproduce with [noinline]; void→value rethrow is a silent wrong value](../learnings/1793316146558-slang-result-void-e-catch-bugs-only-reproduce-with.md).

**Source learnings (8):**
- [Slang `throws E` with a generic error type fails at the try site (visitTryExpr reads unsubstituted errorType)](../learnings/1791396633466-slang-throws-e-with-a-generic-error-type-fails-at-.md) — E30095/E30093 for generic E; use getErrorCodeType(astBuilder, declRef); accessors/lambdas have no errorType
- [Slang property/subscript accessors never get the Bottom errorType default](../learnings/1791396718277-slang-property-subscript-accessors-never-get-the-b.md) — only checkCallableDeclCommon sets it; fix at the default, not the consumer; nested `try g(f())` escapes E30094
- [Slang `try g(f())` miscompiles: nested throwing calls lower as plain Call; lowerErrorHandling only rewrites TryCall](../learnings/1791399033479-slang-try-g-f-miscompiles-nested-throwing-calls-lo.md) — per-InvokeExpr try marks, identity visitTryExpr, reset in withParentLambdaExpr; findErrorHandler prev bug
- [Throwing [Differentiable] fails because synthesized derivative members drop errorType, not the requirement types](../learnings/1791996535059-throwing-differentiable-fails-because-synthesized-.md) — E38105×3 then release assert; 2-line errorType copy fixes primal use; `lowerErrorHandling` precedes autodiff; `__associatedfunc` signature lives in `funcType` (#13508)
- [Lambda bodies are checked twice; statement-stack leaks are hidden by pass 2](../learnings/1791398551841-lambda-bodies-are-checked-twice-statement-stack-le.md) — expressions see only the leaked outer context; use a null-stmt boundary node; don't skip pass 2
- [Slang checker: decide a diagnostic that depends on how an enclosing call resolves with a pending list, not a re-check](../learnings/1791542677184-slang-checker-decide-a-diagnostic-that-depends-on-.md) — `try int(f())` (#13514): pending `List<InvokeExpr*>`, settle at every early exit, `invoke == resolved`; zero-annotation exhaustive test.
- [Before asserting an AST invariant at a consumer, probe overloaded + erroneous-member callees](../learnings/1791418093072-before-asserting-an-ast-invariant-at-a-consumer-pr.md) — CompleteOverloadCandidate Flavor::Func must return an error expr when the base is an error
- [`Result<void,E>` `getResultError` returns the whole `{tag, AnyValue}` struct (pre-#6916); peephole hides it after inlining, so repro with `[noinline]`; `-vk` segfault on invalid SPIR-V](../learnings/1793316146558-slang-result-void-e-catch-bugs-only-reproduce-with.md)

_Catalog: [[wiki/index.md]]_
