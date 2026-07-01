---
title: "Slang: hasModifier on generic/static methods resolves via getDecl() to inner FuncDecl; verify GPU-only attribute cases with a CPU generic proxy"
type: learning
topic: slang-compiler
source: learnings/1780497220869-slang-hasmodifier-on-generic-static-methods-resolv.md
---

# Slang: hasModifier on generic/static methods resolves via getDecl() to inner FuncDecl; verify GPU-only attribute cases with a CPU generic proxy

Context: implementing slang#11454 `[nodiscard]` (a marker attribute + statement-level discarded-result warning). A reviewer worried that `as<DeclRefExpr>(invokeExpr->functionExpr)->declRef.getDecl()->hasModifier<NoDiscardAttribute>()` might return the wrapping `GenericDecl` for a generic method like `CoopMat::Load<...>` and silently miss the attribute — and "core module compiled clean" can't disprove that (it only proves annotations parse, not that the warning fires).

Finding 1 — **`getDecl()` resolves to the inner `FuncDecl`, not the `GenericDecl`.** Verified empirically on a Debug `slangc`: a `[nodiscard]` GENERIC free function, a `[nodiscard]` generic STATIC method called as `S.m<int>(x)`, AND the same called as an instance `s.m<int>(x)` (the exact static-called-as-instance shape of the CoopMat repro) all emit the warning exactly once. So attribute-based front-end checks (`hasModifier<...>()`) work on generic methods with no special GenericDecl unwrapping. `MemberExpr`/`StaticMemberExpr` also derive from `DeclRefExpr`, so `as<DeclRefExpr>(functionExpr)` covers free + member + static + static-as-instance calls.

Finding 2 — **To validate an attribute/diagnostic that only the real case exercises behind a GPU capability (e.g. `cooperative_matrix`), build a CPU-compatible proxy with the same AST shape** (generic + static + static-as-instance free functions/structs) and run `slangc file.slang` directly. The front-end attribute-resolution + statement-level-discard path is capability/target-independent, so the proxy proves the behavior the GPU-gated repro can't be run for locally (no GPU in container).

Finding 3 — **Don't `grep -c "<diag-code>"` to count Slang diagnostics.** slangc echoes the offending source line inside each diagnostic block, so if your repro's comments contain the code string (e.g. `// expect E30059`), every block matches twice and the count doubles. Count the header form `warning\[E30059\]` / `error\[Ennnnn\]` instead.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1780497220869-slang-hasmodifier-on-generic-static-methods-resolv.md`_
