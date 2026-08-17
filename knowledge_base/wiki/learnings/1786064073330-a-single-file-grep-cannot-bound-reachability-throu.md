---
title: "A single-file grep cannot bound reachability through visitor dispatch (Slang)"
type: learning
topic: slang-compiler
source: learnings/1786064073330-a-single-file-grep-cannot-bound-reachability-throu.md
---

# A single-file grep cannot bound reachability through visitor dispatch (Slang)

## The bad bound

Reviewing shader-slang/slang#12413, we needed to know whether a temp-sink code path in
`slang-check-conversion.cpp` could reach a new warning emitted inside
`SemanticsVisitor::ResolveInvoke`. The offered — and initially accepted — bound was:

```bash
grep -c ResolveInvoke source/slang/slang-check-conversion.cpp   # → 0
```

"Zero occurrences, so that file cannot reach `ResolveInvoke`."

**The grep is true; the conclusion is false.** The real path:

`CheckTerm`/`CheckExpr` → `dispatchExpr` → `visitInvokeExpr` →
`CheckInvokeExprWithCheckedOperands` (`slang-check-expr.cpp:5163`) → `ResolveInvoke`
(`:4235`)

It works because `class ExplicitCtorInvokeExpr : public InvokeExpr`
(`slang-ast-expr.h:241`). Dispatch is on the node's **dynamic type**, resolved through the
FIDDLE-generated visitor table in a *different* file, so the calling file never spells the
callee's name.

## Why this bites specifically in Slang

Slang's checker is visitor-dispatched end to end (`dispatchExpr`, `dispatchStmt`,
`_dispatchDeclCheckingVisitor`, the generated `slang-visitor.h.fiddle`). Most interesting
control flow is invisible to a "does file A mention function B" grep **by construction**.
Anything reached via `CheckTerm`, `CheckExpr`, `coerce`, `_coerce`, or `ensureDecl` can land
in an arbitrary `visit*` method elsewhere.

## What to do instead

- Start from the entry point actually called (`CheckTerm`, `CheckExpr`, `coerce`), determine
  the **dynamic type** of the node passed in, and follow the visitor table for that type.
- Or invert: enumerate all callers of the target
  (`grep -rn 'ResolveInvoke' source/slang/`) and ask which are reachable from your context.
  In our case that immediately surfaced `slang-check-expr.cpp:4235` plus five call sites in
  `slang-check-decl.cpp`.
- Check the class hierarchy in `slang-ast-expr.h` before concluding a node "isn't an
  `InvokeExpr`". `OperatorExpr`, `InfixExpr`, `PrefixExpr`, `PostfixExpr`, and
  `ExplicitCtorInvokeExpr` all derive from `InvokeExpr`, so `a + b` and `T(x)` both dispatch
  to `visitInvokeExpr`.

## The meta-lesson (the more expensive half)

Both reviewer and author accepted this bound because it supported a conclusion they had
already reached — downgrading a finding. A *true* statement offered in support of a claim it
does not establish is the easiest error to wave through, and the fact that it **agreed with
us** is exactly what stopped anyone auditing it. Audit the inferential step hardest when the
evidence is convenient.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786064073330-a-single-file-grep-cannot-bound-reachability-throu.md`_
