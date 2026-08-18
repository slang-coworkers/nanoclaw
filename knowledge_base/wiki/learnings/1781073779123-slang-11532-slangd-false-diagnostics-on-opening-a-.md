---
title: "slang #11532 — slangd false diagnostics on opening a module fragment = LS-path manifestation of #11531 phase-ordering bug"
type: learning
topic: slang-compiler
source: learnings/1781073779123-slang-11532-slangd-false-diagnostics-on-opening-a-.md
---

# slang #11532 — slangd false diagnostics on opening a module fragment = LS-path manifestation of #11531 phase-ordering bug

**Issue:** shader-slang/slang#11532 — `slangd` reports false `undefined identifier` + cascaded extension diagnostics (30015 / 38029 / 30855 / 38100) when a module *fragment* (a file starting `implementing <module>;`) is opened directly via LSP `didOpen`. `slangc -I . <umbrella>.slang -target none` is CLEAN, and opening the umbrella in slangd is clean — only opening a fragment fails.

**Why slangc passes but slangd fails (HEAD 29e69b0bf):**
- slangc compiles with the umbrella (`module X; __include a; __include b; …`) as the PRIMARY translation unit; all fragments become `__include`d FileDecls and their reopened `namespace` siblings wire correctly.
- slangd loads the OPENED file fresh as a *standalone* primary module: `WorkspaceVersion::getOrLoadModule` names the module after the opened file's path and calls `loadModuleFromSource` (source/slang/slang-workspace-version.cpp:777, ~804). The umbrella + siblings are pulled back in via an LS-ONLY branch in `SemanticsDeclScopeWiringVisitor::visitImplementingDecl` (slang-check-decl.cpp:16368-16417, guarded `if (!isInLanguageServer()) return;`). Net effect: the opened fragment's `namespace` becomes MODULE-DIRECT while siblings are `__include`d FileDecls — a FileDecl-vs-ModuleDecl asymmetry (cf. #11443) that REORDERS namespace-sibling scope wiring.
- That reordering re-exposes the SAME root cause as sibling #11531: the extension-first pass (slang-check-decl.cpp:5100-5113) drives an `ExtensionDecl` to ReadyForLookup BEFORE the module-wide `ensureAllDeclsRec(moduleDecl, DeclCheckState::ScopesWired)` at ~5132. Validating the extension's target type forces `Box<T:IBase>` (in another fragment) to resolve `IBase` unqualified before iface's `namespace` sibling scope is wired → false diagnostic.

**Triage takeaways:**
1. #11531 (slangc, unqualified names in extension header) and #11532 (slangd, fragment-open) are the SAME phase-ordering root, different trigger. #11532's repro deliberately uses fully-qualified names in the extension header so slangc stays clean — yet slangd still fails. Recommended fix for both: move `ensureAllDeclsRec(…, ScopesWired)` before the extension-first loop (~5100); verify it clears the LS path, else fall back to making the umbrella the primary TU in getOrLoadModule.
2. **Language-server diagnostic bugs ARE reproducible on Linux without a GPU or external LSP client:** slang-test has an in-process LS harness — directive `//TEST:LANG_SERVER(filecheck=CHECK):`, handler `runLanguageServerTest` (tools/slang-test/slang-test-main.cpp:2318). Multi-file modules → give the test its own subdirectory (precedent: tests/language-server/private-ctor-call/) and put the directive on the opened fragment. Build only `slang-test`. This is the go-to for any future slangd diagnostic repro/regression test.
3. General (reinforces #11531 learning): Slang name lookup is side-effect-free / never lazy-wires siblings, so "missing sibling scope / undefined identifier" in multi-fragment modules is almost always a checker phase-ordering issue, not a lookup bug. `DeclCheckState::ScopesWired` is where same-named namespace fragments get sibling scopes wired.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1781073779123-slang-11532-slangd-false-diagnostics-on-opening-a-.md`_
