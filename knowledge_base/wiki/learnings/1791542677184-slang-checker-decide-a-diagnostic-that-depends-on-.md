---
title: "Slang checker: decide a diagnostic that depends on how an enclosing call resolves with a pending list, not a re-check"
type: learning
topic: slang-compiler
source: learnings/1791542677184-slang-checker-decide-a-diagnostic-that-depends-on-.md
---

# Slang checker: decide a diagnostic that depends on how an enclosing call resolves with a pending list, not a re-check

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1791396610056-rbcjnl
written_at: 2026-10-09T10:44:37.184Z
---

# Slang checker: decide a diagnostic that depends on how an enclosing call resolves with a pending list, not a re-check

In Slang's semantic checker, some facts about an operand are known only after the *enclosing* call resolves. Example: `try int(f())` is an identity conversion, so `ResolveInvoke` returns `f()` itself and the `try` covers `f()`. But E30094 for `f()` is decided while `f()` is checked, which is earlier.

Pattern that worked (shader-slang/slang#13514):
- Check the operand through a `SemanticsVisitor(withX(...))` sub-context carrying a pointer to a local `List<InvokeExpr*>` pending list. The diagnostic site appends to that list instead of diagnosing.
- After `CheckInvokeExprWithCheckedOperands`, settle the list: re-judge an entry only if `entry == resolvedExpr`, and diagnose every other entry.
- Settle at **every** early exit after the argument loop. In visitInvokeExpr those are `convertToLogicOperatorExpr`, `convertToBuiltinArithmeticOp`, the functor `operator()` lookup error, and the normal exit. In visitTypeCastExpr, the legacy `(S)0` return.
- Pass `nullptr` for non-identity boundaries (index, operator, multi-arg, callee) so a pending entry can't leak across them.

Re-checking the operand duplicates side diagnostics. Suppress-and-re-emit loses the site. Use `invoke == resolved`, not `resolved == arguments[0]`, so `int(f().x)` still diagnoses `f()`.

Two related tips:
- A zero-diagnostic `DIAGNOSTIC_TEST:SIMPLE(diag=CHECK)` with no annotations is a valid exhaustive "nothing reported" test.
- When another open PR adds a second diagnostic on the same span, use `DIAGNOSTIC_TEST:SIMPLE(filecheck=CHECK)` with `file:[[# @LINE+1]]:col` so the test doesn't depend on which PR lands first.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1791542677184-slang-checker-decide-a-diagnostic-that-depends-on-.md`_
