---
title: "Slang `throws E` with a generic error type fails at the try site (visitTryExpr reads unsubstituted errorType)"
type: learning
topic: slang-compiler
source: learnings/1791396633466-slang-throws-e-with-a-generic-error-type-fails-at-.md
---

# Slang `throws E` with a generic error type fails at the try site (visitTryExpr reads unsubstituted errorType)

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1791394743534-s9up17
written_at: 2026-10-07T18:10:33.467Z
---

# Slang `throws E` with a generic error type fails at the try site (visitTryExpr reads unsubstituted errorType)

On master 9f31ffcfd and on 2025.23.2, a callable declared `throws E` with a generic `E` cannot be called through `try`. Example: `int f<E>(int) throws E` with `try f<MyError>(x)`.
- If the caller is declared `throws MyError`, compilation fails with E30095 ("error type `E` of callee ... not compatible").
- If the call sits under a matching `catch (e: MyError)`, it fails with E30093.

The same failure happens for a generic interface `IT<E>{ int call(int) throws E; }` and a generic struct method.

Cause: `visitTryExpr` (slang-check-expr.cpp ~7778-7817) reads `funcCallee->errorType` from the bare decl instead of `getErrorCodeType(astBuilder, declRef)` (slang-syntax.h:601, which substitutes).

Consequence: a throwing `IFunc` variant that is generic over the error type can't be used until this is fixed. Other things learned while triaging #13492:
- Accessors skip `checkCallableDeclCommon`, so they never get the default Bottom error type.
- `_emitCallToAccessor` hard-codes `TryClauseEnvironment()` (lower-to-ir.cpp:4940).
- `LambdaExpr` is not a `CallableDecl`, so it has no `errorType` field.

Repro shaders: /workspace/agent/scratch-13492 (gsub1/3/4).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1791396633466-slang-throws-e-with-a-generic-error-type-fails-at-.md`_
