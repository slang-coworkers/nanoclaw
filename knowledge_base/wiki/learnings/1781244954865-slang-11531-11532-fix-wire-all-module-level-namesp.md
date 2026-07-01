---
title: "Slang #11531/#11532 fix: wire ALL module-level NamespaceDecls before the extension-first pass (not enclosing-only, not whole-module) — landed via maintainer PR #11577"
type: learning
topic: slang-compiler
source: learnings/1781244954865-slang-11531-11532-fix-wire-all-module-level-namesp.md
---

# Slang #11531/#11532 fix: wire ALL module-level NamespaceDecls before the extension-first pass (not enclosing-only, not whole-module) — landed via maintainer PR #11577

Terminal resolution of shader-slang/slang#11531 (+#11532): the unqualified-name-lookup-in-a-reopened-namespace failure (E30015 → E30855) was fixed by driving EVERY module-level `NamespaceDecl` to `ScopesWired` BEFORE the extension-first checking pass in `checkModule` (source/slang/slang-check-decl.cpp), via a `discoverNamespaceDecls` helper. Maintainer @expipiplus1 adopted this approach + the #11531 regression tests verbatim into PR #11577 ("Closes #11531, #11532"), superseding the bot's #11534 (which was closed).

**The Goldilocks scope — why "all module-level namespaces" and not the two obvious alternatives:**
- **Enclosing-only** (wire just the extension's lexically-enclosing namespace): covers #11531 (extension declared lexically inside the reopened namespace) but NOT #11532 — there the namespace needing wiring is the extension TARGET type's, reached from a DIFFERENT (sibling) reopening fragment. So enclosing-only is too narrow.
- **Blanket `ensureAllDeclsRec(moduleDecl, ScopesWired)`** (wire the whole module): REGRESSED core-module checking — it prematurely advanced the standard library's non-namespaced texture extensions (`extension _Texture<...>`) so their targets resolved to `error`. Too broad. (This is the concrete reason the early "Approach A" full-ensureAllDeclsRec attempt was reverted mid-task.)
- **Correct:** `discoverNamespaceDecls` collects only `NamespaceDecl`s (NOT the `ModuleDecl`), leaving the global scope to the regular pass — wires exactly the namespaces, avoiding the texture-extension regression while covering both the lexically-enclosing (#11531) and sibling-target (#11532) cases.
- Recursion gating: `as<NamespaceDeclBase>(parent) || as<FileDecl>(parent)` (module/namespace/file scopes only) — namespaces never nest in generics or struct/function bodies, so don't walk those.

**Cross-form coverage:** this single `checkModule` namespace-scope-wiring path covers BOTH the same-module `__include`/`implementing` fragment form and the cross-module `import` form (the imported module's namespace is linked as a sibling scope) — verified by 3-cell A/B (see prior learning on the shared scope-wiring path).

**Reusable harness gap (for language-server-symptom triage):** the `//TEST:LANG_SERVER` harness does NOT reliably service a standalone `implementing` fragment — the request blocks — confirmed independently by the maintainer. #11532's symptom is language-server-only (the umbrella module compiles fine via `slangc`), so it has NO automated regression; it's verified MANUALLY against the repro, with the shared code path covered by the non-LS #11531 compile tests. Pattern: when an LS-only symptom shares its underlying code path with a compilable case, cover the path with a normal compile test + manual LS verification rather than fighting the LS harness.

**Process note:** the bot's root-cause analysis, fix, and tests were adopted verbatim into the maintainer's replacement PR even though the bot's own PR (#11534) was closed/superseded. "Landing by adoption" is a positive terminal outcome — the work shipped; don't read a closed bot PR as failure when a maintainer PR credits and absorbs it.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1781244954865-slang-11531-11532-fix-wire-all-module-level-namesp.md`_
