---
title: "Slang error handling: throws, try, catch — checking and lowering"
type: concept
group: slang-language-core
tags: [slang, throws, try, catch, errorType, bottom-type, visitTryExpr, TryCall, lowerErrorHandling, lambda, accessor, overload-resolution, front-end]
source_count: 5
---

# Slang error handling: throws, try, catch — checking and lowering

How Slang's `throws`/`try`/`catch` feature is represented on callables, checked at the `try` site, and lowered to `Result<T,E>`, and the October 2026 bug cluster (#13488–#13492) that showed where each layer is incomplete.

## TL;DR

- Every callable's "does not throw" default (`errorType = Bottom`) is set in exactly one place, `checkCallableDeclCommon`. Property/subscript accessors never reach it and have no `throws` syntax, so their `errorType` is null.
- Read a callee's error type through `getErrorCodeType(astBuilder, declRef)`: it substitutes generic arguments and maps null to Bottom. Reading `funcDecl->errorType` off the bare decl is wrong twice: generic `throws E` never matches at the call site, and accessors segfault.
- A crash on a null accessor `errorType` is fixed where the Bottom default is set for accessors, not with a guard at the consumer.
- `visitTryExpr` keeps the enclosing try clause set while the whole operand is checked, but only the outermost call is validated and lowered as a `TryCall`. So `try g(f())` escapes E30094 and miscompiles: the nested throwing call lowers as a plain `Call`.
- `lowerErrorHandling` changes every throwing function to return `Result<T,E>` but rewrites only `TryCall`/`Throw`/`Return`, so any plain `Call` to a throwing function passes the `Result` wrapper on as the value (invalid HLSL/SPIR-V, on every release since `throws` landed in 2025.12).
- The principled fix marks the try on each throwing `InvokeExpr` during checking, validates every covered call, and makes `visitTryExpr` an identity wrapper. Short-circuit and `?:` arms already lower into separate blocks, so per-call marks stay correct there.
- Lambda bodies are checked twice. Pass 1 runs inside the enclosing function's context; pass 2 re-checks statements but not expressions. Expression-level checks such as the try-clause check see only the leaked outer context, so a lambda inside a `try` operand or a `defer` gets wrong diagnostics.
- A lambda-context fix must neither clear the outer statement stack (optional-witness refinement needs the enclosing `if`) nor skip pass 2 (it does return coercion). A null-statement boundary node works.
- "Overload resolution always gives the callee a `FuncType`" is false: the member reference can still be rejected after overload selection (static↔instance, `this` in a static), leaving an `ErrorType` callee under a non-error call. Probe overloaded callees, not just single candidates, before asserting such an invariant.
- `BottomType`/`Never` is used only as the throws error type, not as a noreturn marker.

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

**Source learnings (5):**
- [Slang `throws E` with a generic error type fails at the try site (visitTryExpr reads unsubstituted errorType)](../learnings/1791396633466-slang-throws-e-with-a-generic-error-type-fails-at-.md) — E30095/E30093 for generic E; use getErrorCodeType(astBuilder, declRef); accessors/lambdas have no errorType
- [Slang property/subscript accessors never get the Bottom errorType default](../learnings/1791396718277-slang-property-subscript-accessors-never-get-the-b.md) — only checkCallableDeclCommon sets it; fix at the default, not the consumer; nested `try g(f())` escapes E30094
- [Slang `try g(f())` miscompiles: nested throwing calls lower as plain Call; lowerErrorHandling only rewrites TryCall](../learnings/1791399033479-slang-try-g-f-miscompiles-nested-throwing-calls-lo.md) — per-InvokeExpr try marks, identity visitTryExpr, reset in withParentLambdaExpr; findErrorHandler prev bug
- [Lambda bodies are checked twice; statement-stack leaks are hidden by pass 2](../learnings/1791398551841-lambda-bodies-are-checked-twice-statement-stack-le.md) — expressions see only the leaked outer context; use a null-stmt boundary node; don't skip pass 2
- [Before asserting an AST invariant at a consumer, probe overloaded + erroneous-member callees](../learnings/1791418093072-before-asserting-an-ast-invariant-at-a-consumer-pr.md) — CompleteOverloadCandidate Flavor::Func must return an error expr when the base is an error

_Catalog: [[wiki/index.md]]_
