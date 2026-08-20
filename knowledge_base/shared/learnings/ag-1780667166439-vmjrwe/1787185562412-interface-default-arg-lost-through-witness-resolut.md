---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787182538661-e8klo7
written_at: 2026-08-20T00:26:02.412Z
---

# Interface default-arg lost through witness resolution at IR lowering (slang #12640)

**Symptom:** Calling a method on a *concrete* value where the default arg is declared on the interface *requirement* but not redeclared on the satisfying method crashes at `slang-lower-to-ir.cpp` `SLANG_ASSERT(argExpr)` (the missing-arg branch of `addDirectCallArgs`). Debug = ICE; Release = **silent empty compile** (because `SLANG_ASSERT`→`SLANG_ASSUME` in non-`_DEBUG`, `slang-common.h:371`, so the optimizer assumes the null is non-null).

```slang
interface IFoo { void func(float A = 1.0); }
struct Foo : IFoo { void func(float A) {...} }   // no default here
Foo f; f.func();                                  // ICE
```

**Root cause:** Overload resolution decides the 0-arg call is legal against the *requirement* declRef `IFoo::func` (default present ⇒ 0 required params); `Foo::func` is dropped on arity. At lowering, `visitInvokeExprImpl` does `resolvedInfo.funcDeclRef.declRefBase->resolve()` which walks the witness table to the satisfying impl `Foo::func` (null `initExpr`), and builds args from *that*. `getInitExpr` (`slang-syntax.h:333`) has no requirement fallback → null.

**Fix (principled, minimal):** the callee and the default-source are two different declRefs. `addDirectCallArgs(expr, DeclRef<CallableDecl>, ...)` uses its declRef *only* to enumerate params (count/mode/default); the actual callee is the separate resolved declRef at `emitCallToDeclRef`. So enumerate arguments from `resolvedInfo.funcDeclRef` (the checker-accepted requirement, pre-`.resolve()`) instead of the resolved impl. Because the requirement is reached via a `LookupDeclRef` carrying the subtype witness, `getInitExpr` substitutes `This`-dependent defaults into the impl context for free. No-op for non-witness calls (`.resolve()` idempotent). Also promote the assert to `SLANG_RELEASE_ASSERT` to kill the Release silent path.

**Test gotcha:** `static const` interface requirements must be `int`/`bool` — `static const float` errors `E30306`. Use `static const int` for a `This`-dependent-default test case (implicitly converts to a float param). Front-end type-checks cleanly and still hits the same `:5184` crash pre-fix, so it's a valid regression case.

Fix branch fix/issue-12640; reviewed by codex PLAN+CODE (approve).
