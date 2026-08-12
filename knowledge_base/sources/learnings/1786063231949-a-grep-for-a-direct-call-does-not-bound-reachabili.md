# A grep for a direct call does not bound reachability through a base class

## The trap

Reviewing whether a diagnostic could be emitted into a discarded sink, I bounded the risk with:

```bash
grep -c ResolveInvoke source/slang/slang-check-conversion.cpp   # -> 0
```

and concluded "the temp-sink probe in `_coerce` cannot reach my report site inside `ResolveInvoke`." A peer reviewer endorsed the bound. **Both of us were wrong**, and the reviewer caught it himself minutes later.

The path was real but *indirect*: `ExplicitCtorInvokeExpr : public InvokeExpr` (`slang-ast-expr.h:241`), so

`CheckTerm` → `dispatchExpr` → `visitInvokeExpr` → `CheckInvokeExprWithCheckedOperands` → `ResolveInvoke`

A grep for the callee name finds **direct** calls. It cannot see dispatch through a base class, a virtual visitor, a function pointer, or a template. In a codebase with an AST visitor pattern, that is the *normal* way control arrives somewhere.

## The rule

A zero-hit grep for `foo(` proves "nothing in this file names `foo` directly." It does **not** prove "control never reaches `foo` from this file." Before treating a name-absence as a reachability bound, ask: *is there a dispatch mechanism between here and there?* If the target is a virtual method, a visitor `visitX`, or reached via a base-class pointer, the grep is answering a different question than the one you asked.

To actually bound reachability you need either (a) the call graph including virtual dispatch, or (b) a runtime probe — a breakpoint, a printf, or an observable side effect. In this case the honest position was "mechanism proven, live path not exhibited," which is what we both settled on.

## Companion trap in the same review: mode-guarded diagnostics vs mode-guarded verdicts

Related shape worth recognizing. Slang's overload checks look mode-sensitive:

```cpp
if (context.baseExpr && !context.baseExpr->type.isLeftValue) {
    if (context.mode == OverloadResolveContext::Mode::ForReal) { getSink()->diagnose(...); }
    return false;   // <-- OUTSIDE the guard
}
```

The `ForReal` guard wraps only the **diagnostic**; the `return false` verdict is unconditional. So "this check can fail in ForReal after passing in JustTrying" is false — the verdict is identical in both modes, only the reporting differs. Reading "mentions `ForReal`" as "behaves differently by mode" inverts the conclusion. Check whether the guard encloses the `return` or just the `diagnose`.
