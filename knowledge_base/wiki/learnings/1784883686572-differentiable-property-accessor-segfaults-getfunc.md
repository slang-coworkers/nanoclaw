---
title: "Differentiable property accessor segfaults getFuncType — PropertyDecl is not a CallableDecl"
type: learning
topic: misc
source: learnings/1784883686572-differentiable-property-accessor-segfaults-getfunc.md
---

# Differentiable property accessor segfaults getFuncType — PropertyDecl is not a CallableDecl

**Symptom (shader-slang/slang#12210):** `[Differentiable]` (or `[TreatAsDifferentiable]`/`[ForwardDifferentiable]`/`[BackwardDifferentiable]`) on a struct **property** accessor crashes slangc with a segfault (`0xC0000005` / error 3221225477 on Windows, SIGSEGV/139 on Linux) and **no diagnostic**. Minimizes to a decl that is never even used, no CUDA, no `__fwd_diff`:
```slang
struct S { property V : float { [Differentiable] get { return 1.0; } } }
```

**Key discriminator:** a `[Differentiable]` **subscript** accessor compiles fine; only a **property** accessor crashes. `[TreatAsDifferentiable]` and even an empty `get;` in an `interface` crash too → the bug is purely front-end declaration-header checking, NOT any IR/autodiff pass.

**Root cause:** `getFuncType` (`source/slang/slang-syntax.cpp:1122-1124`) does `if (as<SubscriptDecl>(parent) || as<PropertyDecl>(parent))` then `getParameters(astBuilder, parent.as<CallableDecl>())`. `SubscriptDecl : public CallableDecl` (has index params — the branch exists to prepend them to the accessor's effective signature). But `PropertyDecl : public ContainerDecl` — **NOT** a CallableDecl. `DeclRef::as<CallableDecl>()` never returns null (it just rewraps the same `declRefBase`), so the cast "succeeds" and the code walks a PropertyDecl as if it had a param list → null-deref in `ContainerDeclDirectMemberDecls::isUsingOnDemandDeserialization()` at `slang-ast-decl.cpp:247`. Regression from PR #5922 (commit e93cb8a4d, Dec 2024), which added `|| as<PropertyDecl>(parent)` to that branch.

**Fix:** restrict the param-prepend branch to `as<SubscriptDecl>(parent)` only (a property contributes zero params; the accessor's own param loop right below already covers a setter's value param).

**Two reusable lessons:**
1. `DeclRef::as<U>()` does NOT validate the target type — it rewraps the same `declRefBase` and returns a non-null DeclRef even when the underlying decl isn't a `U`. Use `as<U>(node)` on the raw decl (or `declRef.is<U>()`) to actually test the type before treating a DeclRef as that type. A guard like `if (declRef.as<CallableDecl>())` is a no-op.
2. When triaging a "crash with no diagnostic," minimize aggressively first — the reporter's repro here was CUDA+slangtorch+`__fwd_diff`, but the actual trigger was a single unused decl. Then get a symbolized backtrace even without gdb: build a tiny `LD_PRELOAD` `.so` with a SIGSEGV `sigaction` that calls `backtrace()`/`backtrace_symbols_fd()`, run the Debug binary under it, and `addr2line -f -C -e libslang-compiler.so.<ver> <offset>` each frame.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784883686572-differentiable-property-accessor-segfaults-getfunc.md`_
