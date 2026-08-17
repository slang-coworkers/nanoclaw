---
title: "Slang import re-export: parentDecl==moduleDecl conjunct is load-bearing via transitive import, not using-namespace"
type: learning
topic: slang-compiler
source: learnings/1780493659932-slang-import-re-export-parentdecl-moduledecl-conju.md
---

# Slang import re-export: parentDecl==moduleDecl conjunct is load-bearing via transitive import, not using-namespace

When reviewing Slang's module re-export filter (`importModuleIntoScope` in slang-check-decl.cpp, mirrored in `_getOrCreateScopeForLegacyLookup` in slang-check-shader.cpp), the keep-predicate is `containerDecl == moduleDecl || (as<FileDecl>(containerDecl) && containerDecl->parentDecl == moduleDecl)`.

**The `parentDecl == moduleDecl` conjunct IS load-bearing — reachable via plain transitive `import`, NOT `using namespace <module>`.** Mechanism: `visitImportDecl` splices an imported module's scopes onto the IMPORTING module's `ownedScope` chain (slang-check-decl.cpp ~16085/16107); `addSiblingScopeForContainerDecl` (slang-check-expr.cpp ~328) links them into `destScope->nextSibling`. So `mid` doing plain `import leaf` puts leaf's `__include`d FileDecls (parentDecl==leaf) onto mid's chain. When `top` imports `mid`, the conjunct is the ONLY thing dropping those foreign FileDecls — weaken it to bare `as<FileDecl>` and they leak (plain `import` wrongly becomes transitive). Empirically: plain import → E30015 (correct); `__exported import` → visible (separate recursion). Negative regression test: top→`import mid`→mid plain `import leaf`; unqualified leaf decl must error E30015.

**Two traps:**
1. `using namespace <module>;` does NOT splice foreign FileDecls (and `ModuleDecl : NamespaceDeclBase`, so it is NOT rejected by `ExpectedANamespace` — rejection, if any, is visibility/E30600). Don't cite ExpectedANamespace as the reason a foreign FileDecl can't be spliced; the real guarantee is provenance-agnostic (the conjunct drops foreign FileDecls regardless of how they arrived).
2. **Convergence ≠ correctness.** In PR #11450, the fixer, Devin, AND the clarity reviewer all independently concluded the conjunct was "defensive/not testable" — because all three anchored on the `using namespace <module>` framing. Only an independent investigation that asked "is there ANOTHER path?" (plain transitive import) found it was load-bearing and testable. When multiple sources agree a clause is untestable/defensive, re-derive the reachable paths from first principles before accepting it.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1780493659932-slang-import-re-export-parentdecl-moduledecl-conju.md`_
