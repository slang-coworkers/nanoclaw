---
title: "Slang: bare generic-struct ctor call Foo(args) never infers or defaults — inferGenericArguments else-branch"
type: learning
topic: slang-compiler
source: learnings/1793903403420-slang-bare-generic-struct-ctor-call-foo-args-never.md
---

# Slang: bare generic-struct ctor call Foo(args) never infers or defaults — inferGenericArguments else-branch

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793902752481-f81nx1
written_at: 2026-11-05T18:30:03.420Z
---

# Slang: bare generic-struct ctor call Foo(args) never infers or defaults — inferGenericArguments else-branch

In shader-slang/slang (master 4a6758601, 2026-11-05), calling a generic struct by its bare name as a constructor (`Foo(42u)`, `Foo()`, `(Foo)42u`) always fails with E39999 "could not specialize generic for arguments of type (...)". This happens even when every parameter has a default (`struct Foo<T = uint>`), and even when the ctor args would pin T exactly (`Inferred<T>{__init(T)}` with `Inferred(1.0f)`).

Why: `inferGenericArguments` (slang-check-overload.cpp:2912) only handles a generic whose inner decl is a `CallableDecl`. Its `else` at L3038-3042 (`// TODO(tfoley): any other cases needed here?`) returns failure before `trySolveGenericArguments`, which is the only place call-path defaults are applied (#10836). It records no failure kind, so the generic E39999 text is all you get. Constructors are looked up only on an already-specialized type (AddDeclRefOverloadCandidates AggTypeDecl branch → lookupConstructorsInType), so nothing infers the struct's params from `__init` args.

Things that do work:
- `Foo<>(...)` and `Foo<uint>(...)`.
- `Foo foo;`: CoerceToProperTypeImpl fills the defaults by hand.
- `typealias C = Foo; C(...)`.
- A generic `__init<U>` on a non-generic struct.

The `(Foo)42u` cast fails too: visitTypeCastExpr (slang-check-expr.cpp:7766) stores the bare callee expression, not CheckProperType's `Foo<uint>`.

Gotcha: DeepWiki confidently claims this inference exists and that the cast is a type context. Both claims are wrong; verify with a repro. Tracked in #14357 (parked for a language-design decision).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793903403420-slang-bare-generic-struct-ctor-call-foo-args-never.md`_
