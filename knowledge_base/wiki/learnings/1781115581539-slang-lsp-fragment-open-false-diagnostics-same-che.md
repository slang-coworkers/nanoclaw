---
title: "Slang LSP fragment-open false diagnostics: same checkModule ordering bug as #11531; verify GPU-free via LANG_SERVER test"
type: learning
topic: slang-compiler
source: learnings/1781115581539-slang-lsp-fragment-open-false-diagnostics-same-che.md
---

# Slang LSP fragment-open false diagnostics: same checkModule ordering bug as #11531; verify GPU-free via LANG_SERVER test

Issues #11531 and #11532 (both @ multi-fragment modules, sibling-namespace name resolution) share ONE root cause: a phase-ordering inversion in `SemanticsDeclVisitor::checkModule` (`source/slang/slang-check-decl.cpp`). The extension-first validation pass drives extension/struct headers (e.g. `Box<T : IBase>`) to name-lookup readiness BEFORE the module-wide `ensureAllDeclsRec(moduleDecl, ScopesWired)` pass wires sibling reopened-`namespace` fragments into the lookup chain. So an unqualified name declared in one fragment can't see the same name in a sibling fragment → `error 30015: undefined identifier`, cascading to 38029/30855/38100.

- **#11531 trigger:** unqualified names in an extension header (`slangc` reproduces). FIXED in draft PR **#11534** (`Fix #11531: wire extension's enclosing namespace before header resolution`, head `fix/issue-11531`), held as draft pending human review.
- **#11532 trigger:** opening a module *fragment* (`implementing <mod>;`) directly in slangd. `slangc` stays clean (umbrella = primary TU → fragments wire in correct order); slangd loads the opened fragment as PRIMARY (`WorkspaceVersion::getOrLoadModule` → `loadModuleFromSource(moduleName=<path>)`, `slang-workspace-version.cpp:777-822`), which changes wiring order and exposes the inversion. So a module clean under `slangc` can still misreport missing types in the editor.

**Cross-issue lesson:** when two issues from the same reporter hit the same subsystem, check whether an in-flight fix PR already covers both — #11534 fixes #11531 but does NOT reference #11532, so #11532 needs explicit verification + its own regression test even though the fix likely already resolves it.

**GPU-free LSP verification technique (broadly reusable):** slang-test has an in-process language-server harness. Directive `//TEST:LANG_SERVER(filecheck=CHECK):`, handler `runLanguageServerTest` (`tools/slang-test/slang-test-main.cpp` ~2318). It starts an in-process JSON-RPC LS, sets the workspace to the test file's PARENT dir, sends `didOpen`, and FileChecks published diagnostics — NO GPU or external editor needed. Multi-file modules → a test subdirectory (precedent: `tests/language-server/private-ctor-call/`). Build only `slang-test`. This reproduces editor-only diagnostics (like #11532) that `slangc` can't surface.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1781115581539-slang-lsp-fragment-open-false-diagnostics-same-che.md`_
