---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787410673109-a8l5gk
written_at: 2026-08-22T15:09:44.320Z
---

# Interface-requirement default argument crash — producer/consumer mismatch (slang #12640/#12700)

**Symptom.** Calling a zero-arg method on a concrete struct where the method is an interface requirement carrying a default argument, and the implementing struct omits the default, crashes: Debug asserts at `source/slang/slang-lower-to-ir.cpp:5180` (`SLANG_ASSERT(argExpr)`), Release SIGSEGVs (null-deref, assert compiled out). Target-independent (spirv/cpp/front-end-only all crash) → fault is in AST→IR lowering.

```slang
interface IFoo { void func(float A = 1.0); }              // #12640: literal default
interface IFoo { static const int kDefault; void func(int a = kDefault); }  // #12700: This-dependent default
struct Foo : IFoo { void func(float A) { ... } }          // no default redeclared
... Foo f; f.func();                                       // crashes
```

**Root cause (producer/consumer mismatch).** Overload resolution accepts the 0-arg call because `CountParameters` (`slang-check-overload.cpp:26`, `:51 !param->initExpr`) reads `initExpr` off the *winning candidate's own* params, and the winning candidate is the interface **requirement** DeclRef, which carries the default (`required=0`). But the checker never materializes the trailing default — `CompleteOverloadCandidate` (`:1671-1737`) builds the InvokeExpr from supplied args only. Materialization is deferred to IR lowering (`addDirectCallArgs`, `slang-lower-to-ir.cpp:5149`), which calls `getInitExpr(astBuilder, paramDeclRef)` (`:5179`, = `declRef.substitute(decl->initExpr)`, `slang-syntax.h:333-336`). That returns null when the ParamDecl's `initExpr` is null → assert. Conformance (`slang-check-conformance.cpp`) never copies a requirement's default onto the satisfying method's param.

**#12640 vs #12700.** Same root cause. On a no-fix tree they crash IDENTICALLY at `:5180` — do NOT assume a "follow-up" issue is a distinct crash. The distinction is forward-looking: a narrow #12640-only lowering fallback (read the requirement param's raw default) fixes the literal case but leaves #12700 broken, because a `This`-dependent default (`kDefault`) needs This/witness substitution to resolve `kDefault → Foo::kDefault` (open TODO at `slang-lower-to-ir.cpp:5370`). **A producer-side materialization with full This/witness substitution subsumes both.**

**Fix machinery (producer-side, recommended).** In `CompleteOverloadCandidate`, substitute the requirement param's `initExpr` through the concrete call's This-type/witness SubstitutionSet and append to `callExpr->arguments`: `applySubstitutionToExpr` (`slang-ast-decl-ref.cpp:849-852`), `LookupDeclRef`/`tryLookUpRequirementWitness` (`slang-syntax.cpp:715-810`), `DeclRefType::_substituteImplOverride` (`slang-ast-type.cpp:151-190`). Ties into `TODO(tfoley)` at `slang-check-overload.cpp:55-63`. Alternative sanctioned by the reporter: emit a clean diagnostic instead of compile-with-default. Any fix MUST close the Release segfault, not just the Debug assert. Regression tests near `tests/compute/generic-default-arg.slang`, `tests/language-feature/parameters/generic-func-param-default-arg.slang`.

**Triage caveat.** DeepWiki gave an internally inconsistent answer about which ParamDecl lowering reads — trust the local source trace over DeepWiki for that mechanism-level detail.
