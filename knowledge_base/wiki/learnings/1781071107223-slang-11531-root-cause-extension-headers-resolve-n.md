---
title: "slang #11531 root cause: extension headers resolve names before namespace fragments reach ScopesWired"
type: learning
topic: slang-compiler
source: learnings/1781071107223-slang-11531-root-cause-extension-headers-resolve-n.md
---

# slang #11531 root cause: extension headers resolve names before namespace fragments reach ScopesWired

# slang #11531: cross-fragment namespace lookup fails inside `extension` headers (checker phase-ordering inversion)

**Symptom:** A module split across `implementing`/`__include` files reopens the same `namespace N` in two fragments. An `extension` declared in fragment 2 fails to resolve unqualified names (`IBase`, `Add`, …) that were declared in fragment 1's `namespace N` — error 30015, cascading to 30855 ("generic parameter not referenced by extension target type 'error'"). Qualifying with `N::X` works. The errors land ONLY on the extension HEADER (generic-param constraints, target type, `where`-clauses).

**Root cause (HEAD 29e69b0bf, all source/slang/slang-check-decl.cpp unless noted) — ordering inversion in `checkModule`:**
1. Includes resolved early (~5011-5037); FileDecls become module-scope siblings via `importFileDeclIntoScope` → `addSiblingScopeForContainerDecl`.
2. **Extension-first pass:** `discoverExtensionDecls` (~4937) then drives every ExtensionDecl through ScopesWired→ReadyForReference→ReadyForLookup at ~5100-5113, resolving the header via `_validateExtensionDeclTargetType` (~14925) → `_validateExtensionDeclGenericParams` (~15017) — BEFORE the module-wide `ensureAllDeclsRec(moduleDecl, ScopesWired)` at ~5132.
3. `ensureDecl` (~1925-2034) advances only the decl itself, never its parent. So driving the extension to ReadyForLookup never forces its enclosing `namespace N` fragment to ScopesWired.
4. Namespace-fragment sibling wiring is `SemanticsDeclScopeWiringVisitor::visitNamespaceDecl` (~16483-16521, `addSiblingScopeForContainerDecl` ~16510), which runs at ScopesWired. Unqualified lookup (slang-lookup.cpp:802-830) only reads the EXISTING `nextSibling` chain — it does NOT lazy-wire. So the fragment-1 namespace isn't in fragment-2's sibling chain at extension-header time → 30015.
5. Qualified `N::X` works because resolving the namespace token `N` uses already-wired module/file siblings (step 1), independent of the extension fragment's own wiring.

**Recommended fix (Approach A):** run `ensureAllDeclsRec(moduleDecl, DeclCheckState::ScopesWired)` BEFORE the extension-first loop (~5100) instead of after (~5132) — makes "all scopes wired" a precondition of name resolution; no lookup/AST change. Disambiguation worth running: a plain non-extension decl in fragment 2 referencing a fragment-1 name unqualified is predicted to compile fine (only the early extension pass triggers the bug) — confirms the fix needn't touch lookup.

**General lessons:** (1) `DeclCheckState::ScopesWired` is the state at which same-named namespace fragments across files get their sibling scopes wired; anything that resolves names must run after it. (2) Slang's name lookup is intentionally side-effect-free / does not lazy-`ensureDecl` — so "missing sibling scope" bugs are almost always a checker phase-ordering issue, not a lookup bug. (3) Extensions are checked in a dedicated pass before all other decls (so member lookups on types later see extension members); that early pass is a recurring source of "header resolves too early" bugs. Adjacent namespace issues from the same reporter family: #11442 (nested namespace scoping), #11443 (`using namespace` re-export leak).

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1781071107223-slang-11531-root-cause-extension-headers-resolve-n.md`_
