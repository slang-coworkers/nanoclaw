---
title: "Slang init-list-as-argument bugs: check canCoerce viability-probe (outExpr==null) divergence"
type: learning
topic: slang-compiler
source: learnings/1782736932170-slang-init-list-as-argument-bugs-check-cancoerce-v.md
---

# Slang init-list-as-argument bugs: check canCoerce viability-probe (outExpr==null) divergence

When a brace initializer `{...}` works as a var-decl init / return / assignment but is REJECTED (E30019) as a function-call argument, suspect a **canCoerce viability-probe (`outExpr == nullptr`) vs real-coercion (`outExpr` set) divergence**, not the legacy element reader.

**Concrete instance (slang#11730, PR #11818):** `_coerceInitializerList` tries `createInvokeExprForExplicitCtor` first. For a vector/struct/matrix target it builds and type-checks the constructor (e.g. `float3(a,b)`) fine, but its success `return true` was nested inside `if (outExpr) { *outExpr=...; return true; }`. Overload resolution's `canCoerce` probe calls coercion with `outExpr==nullptr`, so the `return true` was skipped → fell through to `return false` → canCoerce reported the conversion impossible → the candidate was rejected → fallback legacy reader failed → E30019. Non-argument sites pass `outExpr` set, so they worked. Fix: un-nest `return true` (report viability independent of `outExpr`), matching siblings `createInvokeExprForSynthesizedCtor` / `createCtorInvokeExprForAbstractType` which already do so.

**Reusable rules:**
1. In any coercion/conversion helper, the boolean "is this conversion possible" result must NOT depend on whether the caller requested the output AST (`outExpr`). A `return true` gated by `if(outExpr)` is a false-negative trap for `canCoerce`.
2. `_canLookupConstructorsThroughAbstractType` / `createCtorInvokeExprForAbstractType` handle ONLY `GenericTypeParamDeclBase` + pack-element types — NOT vectors/matrices. `vector<T,N>` is a `DeclRefType<StructDecl>` (core-module struct) routed through `createInvokeExprForExplicitCtor`. Don't assume the "abstract" path is the vector path.
3. Diagnose by instrumenting `_coerceInitializerList` (entry + which branch wins) and the `createInvoke*` helpers printing `outExpr` null/set, then compare the var-decl run (outExpr set) against the arg run (a canCoerce pass with outExpr null). The divergence shows up immediately.
4. Process: a fresh git worktree may have uninitialized submodules (`cmake --preset default` fails on `SPIRV-Headers::SPIRV-Headers`) → `git submodule update --init --recursive`. And a two-dot `git diff master..HEAD` can show spurious files if local `master` advanced past your branch point; use the three-dot merge-base `master...HEAD` (what GitHub's PR shows) to judge real scope.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1782736932170-slang-init-list-as-argument-bugs-check-cancoerce-v.md`_
