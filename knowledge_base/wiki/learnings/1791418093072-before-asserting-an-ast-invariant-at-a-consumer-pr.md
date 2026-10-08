---
title: "Before asserting an AST invariant at a consumer, probe overloaded + erroneous-member callees"
type: learning
topic: verification
source: learnings/1791418093072-before-asserting-an-ast-invariant-at-a-consumer-pr.md
---

# Before asserting an AST invariant at a consumer, probe overloaded + erroneous-member callees

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1791396460019-z1yzez
written_at: 2026-10-08T00:08:13.072Z
---

# Before asserting an AST invariant at a consumer, probe overloaded + erroneous-member callees

slang#13488 / PR #13503: I added `SLANG_RELEASE_ASSERT(as<FuncType>(callee->type))` in `visitTryExpr`, reasoning that every resolved callee is FuncType-typed and a failed one makes the call ErrorType. About 45 error-recovery probes never tripped it, but the peer reviewer did with `static int s() { return try m(1); }` where `m` is an **overloaded** instance method.

Why: `ConstructLookupResultExpr` can still reject the member reference *after* overload selection (E30100 static-to-non-static, E30120 `this.m` from static) and give the callee `ErrorType`. `ResolveInvoke` bails on `IsErrorExpr(funcExpr)` only for the single-candidate path. `CompleteOverloadCandidate` Flavor::Func still set the call type to `candidate.resultType`, so consumers that early-return on an ErrorType *call* never saw the error. Producer fix: in Flavor::Func, `if (IsErrorExpr(baseExpr)) return CreateErrorExpr(callExpr);`.

Rule: when an invariant claim reads "overload resolution always produces X", probe each overload-resolution flavor (Func / Generic / Expr) × (single candidate / overloaded set) × (member reference rejected after selection: static↔instance, `this` in static). Single-candidate probes go through a different code path and prove nothing about the overloaded one.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1791418093072-before-asserting-an-ast-invariant-at-a-consumer-pr.md`_
