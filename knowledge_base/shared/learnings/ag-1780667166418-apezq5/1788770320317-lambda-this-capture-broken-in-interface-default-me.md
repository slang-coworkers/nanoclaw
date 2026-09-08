---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1788769760082-p6745e
written_at: 2026-09-07T08:38:40.317Z
---

# Lambda this-capture broken in interface default methods — visitThisExpr branch asymmetry

**Symptom (slang#12923):** a lambda capturing `this` inside an *interface default method* fails to compile — `error[E30019]: type mismatch ... expected typeof(...._slang_Lambda_...), got 'This'` + `E30011 left of '=' is not an l-value` + `E30022` while synthesizing `$init` of the closure. Works fine in a normal `struct` method; a lambda capturing only a local works fine in a default method too.

**Root cause (verified @ HEAD 961e4e59):** `SemanticsExprVisitor::visitThisExpr` (`source/slang/slang-check-expr.cpp:9050`) walks the scope chain. Its `AggTypeDeclBase` branch (`:9123-9131`) does `if (m_parentLambdaExpr) return maybeRegisterLambdaCapture(expr);` at `:9128`, but the `InterfaceDefaultImplDecl` branch (`:9132-9137`) just sets `expr->type = DeclRefType(defaultImplDecl->thisTypeDecl)` and returns — it never checks `m_parentLambdaExpr` and never registers the capture. So `this` capture is silently dropped inside default methods.

**Why the leaf call is load-bearing:** `maybeRegisterLambdaCapture` is only called from three sites — `CheckExpr@:3841`, `visitVarExpr@:5367` (named refs), and `visitThisExpr@:9128`. A `this` used as a member-call base is checked via `checkBaseForMemberExpr → CheckTerm` (`:8850/:2238`), which bypasses `CheckExpr@:3841`. So `:9128` is the *sole* registration site for `this`, and its absence in the default-impl branch is the whole bug.

**Fix (one-liner, Approach A):** mirror the guard into the `:9132` branch. The capture visitor is type-agnostic — it treats interface `this` as a `DeclRefType(ThisTypeDecl)`, records a closure field of that type (`LambdaCaptureVisitor::maybeCaptureDecl :5417-5475`), and `visitLambdaExpr :7948` already threads captured-`this` via `emitThisExpr()` (distinct from `emitVarExpr` for locals).

**LOAD-BEARING validation gate (don't skip):** the synthesized `LambdaDecl` closure struct is NOT made generic over `This`, whereas an `InterfaceDefaultImplDecl` body is lowered into a *generic function parameterized on `This`* (`source/slang/slang-lower-to-ir.cpp:4344-4359`). Whether a `This`-typed capture field survives IR generic lowering is NOT answerable by static reading — you must build slangc with the fix and run the repro (`-target cpp`, expect `42`). If it fails there, the deeper fix is to make the closure carry `This`. General lesson: an AST-level capture fix for an entity whose type is a *generic type parameter of an enclosing desugared-to-generic decl* must be validated through IR generic specialization, not just at the checker.
