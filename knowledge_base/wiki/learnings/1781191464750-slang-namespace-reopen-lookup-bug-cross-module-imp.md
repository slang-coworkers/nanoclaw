---
title: "Slang namespace-reopen lookup bug: cross-module import and same-module __include share one checkModule scope-wiring path"
type: learning
topic: slang-compiler
source: learnings/1781191464750-slang-namespace-reopen-lookup-bug-cross-module-imp.md
---

# Slang namespace-reopen lookup bug: cross-module import and same-module __include share one checkModule scope-wiring path

For shader-slang/slang issue #11531 (unqualified name lookup inside a *reopened* `namespace` fails — E30015 undefined identifier cascading to E30855 "not referenced by extension target type 'error'"), the failure reproduces in BOTH forms and they go through the SAME code path:

1. Same-module `__include` / `implementing` fragments, and
2. Modern cross-module `import` (separate modules, the reopening module `import`s the declaring module).

**Why they're the same path (verified by code-read @ master d92b15e0 + empirical A/B):**
- The fix for #11531 (PR #11534, branch `fix/issue-11531`) wires an extension's enclosing reopened namespace to `ScopesWired` readiness inside `checkModule` BEFORE the extension-first header-resolution loop runs. The root failure is the reopened `namespace` not being wired to its sibling scopes before the extension header (target type / conformance / `where`-clauses) is resolved.
- `SemanticsDeclScopeWiringVisitor::visitNamespaceDecl` (source/slang/slang-check-decl.cpp:~16483) merges reopened-namespace scopes and is **module-agnostic** — it doesn't distinguish same-module from imported namespaces.
- `importModuleIntoScope` (slang-check-decl.cpp:~16132, via `addSiblingScopeForContainerDecl` in slang-check-expr.cpp:~323) adds an imported module's scope as a `nextSibling` of the importing module's scope. Imports are processed first in `checkModule` (~:5006-5009), before the extension loop's `ScopesWired` (~:5103) and `ensureAllDeclsRec(moduleDecl, ScopesWired)` (~:5132). So when the reopening namespace is wired, the imported module's same-named namespace is a sibling it links, making the imported members resolvable by unqualified name.

**Practical upshot for triage:** when a namespace-reopen/extension lookup fix lands for the fragment form, it very likely also covers the `import` form — don't assume `import` is a separate broken path. Confirm empirically.

**Verification pattern that proved it (rigorous, reusable):** 3-cell A/B — (a) UNPATCHED control built at the fix's *exact parent commit* (grep-confirm the fix symbol is absent) → reproduces the exact error signature; (b) PATCHED branch → clean; (c) QUALIFIED sanity (restore the `repro.` prefixes) → clean on BOTH, isolating "unqualified lookup in a reopened namespace" as the sole variable. Optionally cross-check against an unpatched release binary.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1781191464750-slang-namespace-reopen-lookup-bug-cross-module-imp.md`_
