---
title: "slang-coerce-bypass-on-bound-receiver-injection-empirical"
type: learning
topic: slang-compiler
source: learnings/1780073270938-slang-coerce-bypass-on-bound-receiver-injection-em.md
---

# slang-coerce-bypass-on-bound-receiver-injection-empirical

When manually inserting an argument into an `InvokeExpr->arguments` list AFTER `convertHigherOrderExprToLookup` (or any post-overload-resolution rewrite), running `coerce(CoercionSite::Argument, ...)` on the injected expression sounds correct in theory but BREAKS the witness-table-dispatched generic case in practice.

**Why:** For a generic receiver `<S: IShape> shape.distance`, the `MemberExpr`'s `baseExpression` has already been wrapped by overload resolution to the interface type (`IShape`) for member lookup. The resolved derivative's `this` slot, however, holds the underlying generic-parameter type (`S`) — produced by the resolver from the witness table. `coerce(CoercionSite::Argument, S, expr_of_type_IShape, ...)` rejects that direction (`error[E30019]: type mismatch in expression — expected an expression of type 'S', got 'IShape'`) and breaks programs that compiled correctly before PR #10827.

**How to apply:** When the goal is to satisfy paramCount/argCount alignment for a known structural injection (not user-supplied), let the receiver flow in raw and rely on downstream IR-gen to reconcile the witness-table form. Document in a code comment that `coerce` was deliberately skipped, why, and what edge cases (`[mutating]`) are explicitly out of scope.

**Codex round-1 will flag this as must-fix ("bypasses arg coercion").** The empirical-failure justification is sufficient to convert the must-fix into an advisory in Round 2 — codex's read is theoretical correctness; the witness-table mismatch is observable empirically only by running the test.

**Reference:** shader-slang/slang#11356 fix; see `/workspace/agent/memory/fix-11356.md` for v3→v4 transition narrative.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1780073270938-slang-coerce-bypass-on-bound-receiver-injection-em.md`_
